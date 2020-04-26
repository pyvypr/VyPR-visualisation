var Store = {
    events : [],
    selected_event_index : null,
    current_code_listing : [],
    current_function : null,
    most_recent_function_start_event_index : null,
    // the binding tree is a list of vertices with ids and children
    binding_tree : []
};

var select_event = function(index) {
    var previous_event_index = Store.selected_event_index;
    // store the event index globally
    Store.selected_event_index = index;
    // get the most recent function start event so we can get the function
    // code and the scfg
    var begin_function_event_index = index;
    while(Store.events[begin_function_event_index].action_to_perform != 'begin_function_processing') {
        begin_function_event_index--;
    }
    Store.most_recent_function_start_event_index = begin_function_event_index;
    // display the code listing
    var function_begin_event = Store.events[begin_function_event_index];
    Store.current_code_listing = function_begin_event.data.code;
    // check if the function has been changed
    var function_changed =
        (Store.events[begin_function_event_index].data.function_name != Store.current_function);
    if(function_changed) {
        // set the current function name
        Store.current_function = Store.events[begin_function_event_index].data.function_name;
    }
}

var replay_events = function(start_index, end_index) {
    // given a sequence of events defined by the start and end indices (no restriction on order,
    // so we can move forwards and backwards in time), replay the events with indication of whether to
    // apply them normally, or in reverse
    start_index = start_index === null ? 0 : start_index;
    if(start_index < end_index) {
        // replay forwards in time
        for(var i=start_index+1; i<=end_index; i++) {
            apply_event(Store.events[i], "forwards");
        }
    } else if(start_index > end_index) {
        // replay backwards in time
        for(var i=start_index-1; i>=end_index; i--) {
            apply_event(Store.events[i], "backwards");
        }
    }
    // render the new tree now all transformations have been applied
    render_binding_tree();
};

var apply_event = function(event, direction) {
    // event is a dictionary with an action and data
    // direction is either "forwards" or "backwards" and affects how we apply the event
    // note: when we replay an event, we always assume that the existing state is immediately before
    // or after the event, since we cannot jump between events without applying each one in between.
    if(direction == "forwards") {
        if(event.action_to_perform == "new_binding") {
            // add the new vertex
            Store.binding_tree.push({
                "id" : event.data.vertex_id,
                "children" : [],
                "marked" : false
            });
        } else if(event.action_to_perform == "extend_binding") {
            // add new vertex
            Store.binding_tree.push({
                "id" : event.data.child_vertex_id,
                "children" : [],
                "marked" : false
            });
            // find the parent vertex and modify it
            for(var i=0; i<Store.binding_tree.length; i++) {
                if(Store.binding_tree[i].id == event.data.parent_vertex_id) {
                    Store.binding_tree[i].children.push(event.data.child_vertex_id);
                }
            }
        } else if(event.action_to_perform == "complete_binding") {
            // mark the vertices
            for(var i=0; i<event.data.vertex_ids.length; i++) {
                for(var j=0; j<Store.binding_tree.length; j++) {
                    if(Store.binding_tree[j].id == event.data.vertex_ids[i]) {
                        Store.binding_tree[j].marked = true;
                    }
                }
            }
        }
    }
};

var render_binding_tree = function() {
    // code inspired by https://github.com/dagrejs/dagre/wiki#an-example-layout

    // Create a new directed graph
    var g = new dagreD3.graphlib.Graph().setGraph({});

    // Set an object for the graph label
    g.setGraph({});

    var binding_tree = Store.binding_tree;

    console.log(binding_tree);

    if(binding_tree.length > 0) {
        // set up nodes
        for(var i=0; i<binding_tree.length; i++) {
            var label = String(binding_tree[i].id);
            var stroke = binding_tree[i].marked ? "red" : "black";
            g.setNode(
                binding_tree[i].id,
                {label : label, width : 5*label.length + 20, height: 20, stroke : stroke}
            );
        }

        // set up edges
        for(var i=0; i<binding_tree.length; i++) {
            for(var j=0; j<binding_tree[i].children.length; j++) {
                g.setEdge(binding_tree[i].id, binding_tree[i].children[j], {});
            }
        }

        var svg = d3.select("#binding-tree"),
        inner = svg.select("g");

        // remove all content before rendering anything new
        inner.selectAll().remove();

        // Create the renderer
        var render = new dagreD3.render();

        // Run the renderer. This is what draws the final graph.
        render(inner, g);

        svg.attr('height', g.graph().height + 40);
        svg.attr('width', g.graph().width);
    }
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
                            v-on:click="handlerEventClick($event, index)">
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
        handlerEventClick : function(e, index) {
            // store previous event index
            var previous_event_index = this.store.selected_event_index;
            // select the event
            select_event(index);
            // now, replay events
            replay_events(previous_event_index, this.store.selected_event_index);
        }
    },
    props : ["event_stream"],
    mounted : function() {
        var that = this;
        axios.get(this.event_stream).then(
            function(response) {
                // add event data to property which is bound to html
                that.store.events = response.data;
                // select the first event
                select_event(0);
            }
        );
    }
});

Vue.component("visualisation", {
    template : `
    <div id="visualisation" class="container">
        <div class="vis-on" v-if="dataReady">
            <div class="col-md-5">
                <div class="panel panel-info">
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
                <div class="panel panel-info">
                  <div class="panel-heading">Symbolic Control-Flow Graph</div>
                  <div class="panel-body">
                    <scfg></scfg>
                  </div>
                </div>
            </div>

            <div class="col-md-7">
                <div class="panel panel-info">
                  <div class="panel-heading">Binding Tree</div>
                  <div class="panel-body">
                    <binding-tree></binding-tree>
                  </div>
                </div>
                <div class="panel panel-info">
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

        var svg = d3.select("#scfg"),
        inner = svg.select("g");

        // Create the renderer
        var render = new dagreD3.render();

        // Run the renderer. This is what draws the final graph.
        render(inner, g);

        svg.attr('height', g.graph().height + 40);
        svg.attr('width', g.graph().width);
    }
});

Vue.component("binding-tree", {
    template : `<div class="binding-tree"><svg id="binding-tree"><g></g></svg></div>`,
    data : function() {
        return {
            store : Store
        }
    }
});

var app = new Vue({
    el : "#app"
});