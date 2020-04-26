var Store = {
    events : [],
    selected_event_index : null,
    current_code_listing : [],
    current_function : null,
    current_scfg : null
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
            // display the code listing
            var function_begin_event = this.store.events[begin_function_event_index];
            this.store.current_code_listing = function_begin_event.data.code;
            // check if the function has been changed
            var function_changed =
                (this.store.events[begin_function_event_index].data.function_name != this.store.current_function);
            if(function_changed) {
                // set the current function name
                this.store.current_function = this.store.events[begin_function_event_index].data.function_name;
                // set the scfg
                this.store.current_scfg = this.store.events[this.store.selected_event_index].data.scfg;
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
        <div class="vis-on" v-if="eventIsSelected">
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
        eventIsSelected : function() {
            return this.store.selected_event_index != null;
        }
    }
});

Vue.component("scfg", {
    template : `<svg id="scfg"><g></g></svg>`,
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

        // Default to assigning a new object as a label for each new edge.
        //g.setDefaultEdgeLabel(function() { return {}; });

        console.log(g.nodes());

        console.log(this.store.current_scfg);

        // set up nodes
        for(var i=0; i<this.store.current_scfg.length; i++) {
            g.setNode(
                this.store.current_scfg[i].id,
                {label : String(this.store.current_scfg[i].state_changed), width : 110, height: 30}
            );
        }

        // set up edges
        for(var i=0; i<this.store.current_scfg.length; i++) {
            console.log("setting up edges for " + this.store.current_scfg[i].id);
            for(var j=0; j<this.store.current_scfg[i].children.length; j++) {
                g.setEdge(this.store.current_scfg[i].id, this.store.current_scfg[i].children[j], {});
                console.log("edge from " + String(this.store.current_scfg[i].id) + " to " + String(this.store.current_scfg[i].children[j]));
            }
        }

        console.log(g.nodes());

        var svg = d3.select("svg"),
        inner = svg.select("g");

        // Create the renderer
        var render = new dagreD3.render();

        // Run the renderer. This is what draws the final graph.
        render(inner, g);

        /*// Set up zoom support
        var zoom = d3.zoom().on("zoom", function() {
              inner.attr("transform", d3.event.transform);
            });
        svg.call(zoom);*/

        // Center the graph
        var initialScale = 0.75;
        /*svg.call(
            zoom.transform,
            d3.zoomIdentity.translate((svg.attr("width") - g.graph().width * initialScale) / 2, 20).scale(initialScale)
        );*/

        svg.attr('height', g.graph().height * initialScale + 40);
    }
});

var app = new Vue({
    el : "#app"
});