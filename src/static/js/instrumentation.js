var Store = {
    events : [],
    selected_event_index : null,
    current_code_listing : [],
    current_function : null,
    most_recent_function_start_event_index : null
};

Vue.component("timeline", {
    template : `<div class="timeline">
        <ul class="nav nav-pills">
          <li role="presentation"><a href="/">Home</a></li>
          <li role="presentation"><a href="/instrumentation/">Instrumentation</a></li>
          <li role="presentation"><a href="/monitoring">Monitoring</a></li>
        </ul>
        <div class="event-list">
            <table>
                <tr>
                    <td v-for="(event, index) in store.events">
                        <div class="event"
                            v-on:click="handlerEventClick($event, index, event.action_to_perform, event.data)">
                        <ul>
                            <li class="time"><i>{{ event.time_added }}</i></li>
                            <li class="action"><b>{{ event.action_to_perform }}</b></li>
                            <li v-if="event.action_to_perform == 'new_binding'">root vertex: {{ event.data.vertex_id }}</li>
                            <li v-if="event.action_to_perform == 'extend_binding'">
                                from {{ event.data.parent_vertex_id }} to {{ event.data.child_vertex_id }}
                            </li>
                            <li v-if="event.action_to_perform == 'complete_binding'">full binding: {{ event.data.vertex_ids }}
                            </li>
                            <li v-if="event.action_to_perform == 'begin_function_processing'">{{ event.data.function_name }}</li>
                        </ul>
                        </div>
                    </td>
                </tr>
            </table>
         </div>
    </div>`,
    data : function() {
        return {
            store : Store
        }
    },
    methods : {
        handlerEventClick : function(e, index, action, data) {
            // store the event index globally
            this.store.selected_event_index = index;
            // get the most recent function start event so we can get the function
            // code and the scfg
            var begin_function_event_index = index;
            while(this.store.events[begin_function_event_index].action_to_perform != 'begin_function_processing') {
                begin_function_event_index--;
            }
            this.store.most_recent_function_start_event_index = begin_function_event_index;
            // display the code listing
            var function_begin_event = this.store.events[begin_function_event_index];
            this.store.current_code_listing = function_begin_event.data.code;
            // check if the function has been changed
            var function_changed =
                (this.store.events[begin_function_event_index].data.function_name != this.store.current_function);
            if(function_changed) {
                // set the current function name
                this.store.current_function = this.store.events[begin_function_event_index].data.function_name;
            }
        }
    },
    props : ["event_stream"],
    mounted : function() {
        var that = this;
        axios.get(this.event_stream).then(
            function(response) {
                // add event data to property which is bound to html
                that.store.events = response.data;
            }
        );
    }
});

Vue.component("visualisation", {
    template : `
    <div id="visualisation" class="container">
        <div class="vis-on" v-if="dataReady">
            <div class="col-md-5">
                <div class="panel panel-default">
                  <div class="panel-heading">Code - {{ store.current_function }}</div>
                  <div class="panel-body" id="code">
                    <table>
                        <tr class="code-line-skip" v-if="store.current_code_listing[0].number > 1">
                            <td class="number"></td>
                            <td class="code-wrapper">...</td>
                        </tr>
                        <tr class="code-line" v-for="line in store.current_code_listing">
                            <td class="number">{{ line.number }}</td>
                            <td class="code-wrapper"><pre class="code">{{ line.code }}</pre></td>
                        </tr>
                    </table>
                  </div>
                </div>
                <div class="panel panel-default">
                  <div class="panel-heading">Symbolic Control-Flow Graph</div>
                  <div class="panel-body">
                    <scfg></scfg>
                  </div>
                </div>
            </div>

            <div class="col-md-7">
                <div class="panel panel-default">
                  <div class="panel-heading">Binding Tree</div>
                  <div class="panel-body" id="binding-tree">
                  </div>
                </div>
                <div class="panel panel-default">
                  <div class="panel-heading">Instrumentation Tree</div>
                  <div class="panel-body" id="instrumentation-tree">
                  </div>
                </div>
            </div>
        </div>
        <div class="vis-off" v-else>
            <p>No event selected yet.</p>
        </div>
    </div>
    `,
    data : function() {
        return {
            store : Store
        }
    },
    computed : {
        dataReady : function() {
            return this.store.selected_event_index != null;
        }
    }
});

Vue.component("scfg", {
    template : `<div class="scfg"><svg id="scfg"><g></g></svg></div>`,
    data : function() {
        return {
            store : Store
        }
    },
    mounted : function() {
        // set up scfg with dagre
        // code inspired by https://github.com/dagrejs/dagre/wiki#an-example-layout

        // Create a new directed graph
        var g = new dagreD3.graphlib.Graph().setGraph({});

        // Set an object for the graph label
        g.setGraph({});

        var scfg = this.store.events[this.store.most_recent_function_start_event_index].data.scfg;

        // set up nodes
        for(var i=0; i<scfg.length; i++) {
            var label = String(scfg[i].state_changed);
            g.setNode(
                scfg[i].id,
                {label : label, width : 5*label.length + 20, height: 20}
            );
        }

        // set up edges
        for(var i=0; i<scfg.length; i++) {
            for(var j=0; j<scfg[i].children.length; j++) {
                g.setEdge(scfg[i].id, scfg[i].children[j], {});
            }
        }

        var svg = d3.select("svg"),
        inner = svg.select("g");

        // Create the renderer
        var render = new dagreD3.render();

        // Run the renderer. This is what draws the final graph.
        render(inner, g);

        svg.attr('height', g.graph().height + 40);
        svg.attr('width', g.graph().width);
    }
});

var app = new Vue({
    el : "#app"
});