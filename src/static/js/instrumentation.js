var Store = {
    events : [],
    id_to_event : {},
    selected_event_index : null,
    highlighted_scfg_vertex : null,
    highlighted_line_number : null,
    highlighted_spec_variable : null,
    current_code_listing : [],
    current_function : null,
    most_recent_function_start_event_index : null,
    // each binding tree is a list of vertices with ids and children
    binding_trees : [],
    play_interval : null
};

/******************
Visualisation Logic
*******************/

var get_state_changed_from_id = function(id) {
    // given a vertex ID, get the state information held there
    var scfg = Store.events[Store.most_recent_function_start_event_index].data.scfg;
    for(var i=0; i<scfg.length; i++) {
        if(scfg[i].id == id) {
            return String(scfg[i].state_changed);
        }
    }
    return false;
};

var highlight_line_from_vertex_id = function(vertex_id) {
    // to highlight the relevant line, we need to search the scfg for the id and take the line number
    var scfg = Store.events[Store.most_recent_function_start_event_index].data.scfg;
    for(var i=0; i<scfg.length; i++) {
        if(scfg[i].id == vertex_id) {
            Store.highlighted_line_number = scfg[i].line_number
        }
    }
};

var highlight_backwards = function(event) {
    // highlighting of lines and scfg vertices for moving backwards through time
    var previous_event = Store.id_to_event[event.id-1];
    if(previous_event.action_to_perform == "extend_binding") {
        Store.highlighted_scfg_vertex = Store.id_to_event[event.id-1].data.child_vertex_id;
        highlight_line_from_vertex_id(Store.id_to_event[event.id-1].data.child_vertex_id);
    } else if(previous_event.action_to_perform == "new_binding") {
        Store.highlighted_scfg_vertex = Store.id_to_event[event.id-1].data.vertex_id;
        highlight_line_from_vertex_id(Store.id_to_event[event.id-1].data.vertex_id);
    } else if(previous_event.action_to_perform == "complete_binding") {
        Store.highlighted_scfg_vertex = Store.id_to_event[event.id-1].data.vertex_ids[
            Store.id_to_event[event.id-1].data.vertex_ids.length-1
        ];
        highlight_line_from_vertex_id(
            Store.id_to_event[event.id-1].data.vertex_ids[
                Store.id_to_event[event.id-1].data.vertex_ids.length-1
            ]
        );
    }
};

var highlight_forwards = function(event) {
    // highlighting of lines and scfg vertices for moving forwards through time
    Store.highlighted_scfg_vertex = event.data.child_vertex_id;
    highlight_line_from_vertex_id(event.data.child_vertex_id);
    if(event.action_to_perform == "extend_binding") {
        Store.highlighted_scfg_vertex = event.data.child_vertex_id;
        highlight_line_from_vertex_id(event.data.child_vertex_id);
    } else if(event.action_to_perform == "new_binding") {
        Store.highlighted_scfg_vertex = event.data.vertex_id;
        highlight_line_from_vertex_id(event.data.vertex_id);
    } else if(event.action_to_perform == "complete_binding") {
        Store.highlighted_scfg_vertex = event.data.vertex_ids[
            event.data.vertex_ids.length-1
        ];
        highlight_line_from_vertex_id(
            event.data.vertex_ids[
                event.data.vertex_ids.length-1
            ]
        );
    }
};

var play = function() {
    // this is only ever set inside an interval
    // advance events by replaying from current position onwards.
    if(Store.selected_event_index < Store.events.length-1) {
        Store.selected_event_index++;
        select_event(Store.selected_event_index);
        apply_event(Store.events[Store.selected_event_index], "forwards");
    } else {
        // stop playing
        clearInterval(Store.play_interval);
        Store.play_interval = null;
        // make sure the selected event index stays as the final event, and not past it
        Store.selected_event_index = Store.events.length-1;
    }
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
    Store.current_specification = function_begin_event.data.specification;
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
        for(var i=start_index; i>end_index; i--) {
            apply_event(Store.events[i], "backwards");
        }
    }
};

var apply_event = function(event, direction) {
    // event is a dictionary with an action and data
    // direction is either "forwards" or "backwards" and affects how we apply the event
    // note: when we replay an event, we always assume that the existing state is immediately before
    // or after the event, since we cannot jump between events without applying each one in between.
    if(direction == "forwards") {
        if(event.action_to_perform == "new_binding") {
            // start a new binding tree and add a new vertex
            Store.binding_trees.push([]);
            Store.binding_trees[Store.binding_trees.length-1].push({
                "id" : event.data.vertex_id,
                "children" : [],
                "marked" : false
            });
        } else if(event.action_to_perform == "extend_binding") {
            // add new vertex
            Store.binding_trees[Store.binding_trees.length-1].push({
                "id" : event.data.child_vertex_id,
                "children" : [],
                "marked" : false
            });
            // find the parent vertex and modify it
            for(var i=0; i<Store.binding_trees[Store.binding_trees.length-1].length; i++) {
                if(Store.binding_trees[Store.binding_trees.length-1][i].id
                    == event.data.parent_vertex_id) {
                    Store.binding_trees[Store.binding_trees.length-1][i].children.push(
                        event.data.child_vertex_id
                    );
                }
            }
        } else if(event.action_to_perform == "complete_binding") {
            // mark the vertices
            for(var i=0; i<event.data.vertex_ids.length; i++) {
                for(var j=0; j<Store.binding_trees[Store.binding_trees.length-1].length; j++) {
                    if(Store.binding_trees[Store.binding_trees.length-1][j].id == event.data.vertex_ids[i]) {
                        Store.binding_trees[Store.binding_trees.length-1][j].marked = true;
                    }
                }
            }
        }
        // highlight relevant parts of the screen
        highlight_forwards(event);
    } else if(direction == "backwards") {
        if(event.action_to_perform == "begin_function_processing") {
            // remove all bindings
            Store.binding_trees[Store.binding_trees.length-1] = [];
        } else if(event.action_to_perform == "new_binding") {
            // remove the last binding tree
            Store.binding_trees.splice(Store.binding_trees.length-1, 1);
        } else if(event.action_to_perform == "extend_binding") {
            // find the vertex and remove it
            for(var i=0; i<Store.binding_trees[Store.binding_trees.length-1].length; i++) {
                if(Store.binding_trees[Store.binding_trees.length-1][i].id == event.data.child_vertex_id) {
                    Store.binding_trees[Store.binding_trees.length-1].splice(i, 1);
                }
            }
            // find the parent vertex and remove this child
            for(var i=0; i<Store.binding_trees[Store.binding_trees.length-1].length; i++) {
                if(Store.binding_trees[Store.binding_trees.length-1][i].id == event.data.parent_vertex_id) {
                    for(var j=0; j<Store.binding_trees[Store.binding_trees.length-1][i].children.length; j++) {
                        if(Store.binding_trees[Store.binding_trees.length-1][i].children[j] == event.data.child_vertex_id) {
                            Store.binding_trees[Store.binding_trees.length-1][i].children.splice(j, 1);
                        }
                    }
                }
            }
        } else if(event.action_to_perform == "complete_binding") {
            // unmark the vertices
            for(var i=0; i<event.data.vertex_ids.length; i++) {
                for(var j=0; j<Store.binding_trees[Store.binding_trees.length-1].length; j++) {
                    if(Store.binding_trees[Store.binding_trees.length-1][j].id == event.data.vertex_ids[i]) {
                        Store.binding_trees[Store.binding_trees.length-1][j].marked = false;
                    }
                }
            }
        }
        // highlight relevant parts of the screen
        highlight_backwards(event);
    }
    // render the new tree now all transformations have been applied
    render_binding_trees();
};

var render_binding_trees = function() {
    // code inspired by https://github.com/dagrejs/dagre/wiki#an-example-layout
    // Create a new directed graph
    var g = new dagreD3.graphlib.Graph().setGraph({});

    // Set an object for the graph label
    g.setGraph({rankdir:'LR'});

    if(Store.binding_trees.length > 0) {
        // iterate through binding trees
        for(var binding_tree_index = 0; binding_tree_index < Store.binding_trees.length; binding_tree_index++) {

            var binding_tree = Store.binding_trees[binding_tree_index];

            if(binding_tree.length > 0) {
                // set up nodes
                for(var i=0; i<binding_tree.length; i++) {
                    var label = get_state_changed_from_id(binding_tree[i].id);
                    var stroke = binding_tree[i].marked ? "red" : "black";
                    g.setNode(
                        binding_tree[i].id + "-" + binding_tree_index,
                        {label : label, width : 5*label.length + 20, height: 20, style: "stroke: " + stroke}
                    );
                }

                // set up edges
                for(var i=0; i<binding_tree.length; i++) {
                    for(var j=0; j<binding_tree[i].children.length; j++) {
                        g.setEdge(
                            binding_tree[i].id + "-" + binding_tree_index,
                            binding_tree[i].children[j] + "-" + binding_tree_index,
                            {curve: d3.curveBasis}
                        );
                    }
                }
            }
        }

        var svg = d3.select("#binding-tree"),
        inner = svg.select("g");

        // remove all content before rendering anything new
        inner.selectAll("*").remove();

        // Create the renderer
        var render = new dagreD3.render();

        // Run the renderer. This is what draws the final graph.
        render(inner, g);

        svg.attr('height', g.graph().height + 40);
        svg.attr('width', g.graph().width);
    } else {
        var svg = d3.select("#binding-tree"),
        inner = svg.select("g");

        svg.attr('height', 0);
        svg.attr('width', 0);
    }
};

/******************
Vue Components
*******************/

Vue.component("timeline", {
    template : `
    <div class="timeline">
        <div class="controls">
            <button type="button" class="btn btn-info"
                v-bind:class="getClassPreviousButton()"
                v-on:click="handlerPreviousEvent">
                Previous
            </button>
            <button type="button" class="btn btn-success" v-on:click="handlerTogglePlayStatus">
                {{ play_status }}
            </button>
            <button type="button" class="btn btn-info"
                v-bind:class="getClassNextButton()"
                v-on:click="handlerNextEvent">
                Next
            </button>
        </div>
        <div class="event-list">
            <table>
                <tr>
                    <td v-for="(event, index) in store.events">
                        <div class="event"
                            v-on:click="handlerEventClick($event, index)"
                            v-bind:class="getSelectedStatus(index)">
                        <ul>
                            <li class="time"><i>{{ event.time_added }}</i></li>
                            <li class="action"><b>{{ event.action_to_perform }}</b></li>
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
    computed : {
        play_status : function() {
            return this.store.play_interval == null ? "Play" : "Pause";
        }
    },
    methods : {
        getSelectedStatus : function(event_index) {
            if(this.store.selected_event_index == event_index) {
                return "selected"
            } else return "";
        },
        getClassNextButton : function() {
            if(this.store.selected_event_index >= this.store.events.length-1 || this.store.play_interval != null) {
                return "disabled";
            } else return ""
        },
        getClassPreviousButton : function() {
            if(this.store.selected_event_index == 0 || this.store.play_interval != null) {
                return "disabled";
            } else return ""
        },
        handlerEventClick : function(e, index) {
            // store previous event index
            var previous_event_index = this.store.selected_event_index;
            // select the event
            select_event(index);
            // now, replay events
            replay_events(previous_event_index, this.store.selected_event_index);
        },
        handlerTogglePlayStatus : function(e) {
            if(this.store.play_interval != null) {
                // already playing - stop
                clearInterval(this.store.play_interval);
                this.store.play_interval = null;
            } else {
                // not playing - start
                this.store.play_interval = setInterval(play, 1000);
            }
        },
        handlerNextEvent : function(e) {
            if(this.store.selected_event_index < this.store.events.length-1 && this.store.play_interval == null) {
                this.store.selected_event_index++;
                select_event(this.store.selected_event_index);
                apply_event(this.store.events[this.store.selected_event_index], "forwards");
            }
        },
        handlerPreviousEvent : function(e) {
            if(this.store.selected_event_index != 0 && this.store.play_interval == null) {
                select_event(this.store.selected_event_index);
                apply_event(this.store.events[this.store.selected_event_index], "backwards");
                this.store.selected_event_index--;
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
                // build the event index
                for(var i=0; i<that.store.events.length; i++) {
                    that.store.id_to_event[that.store.events[i].id] = that.store.events[i];
                }
                // select the first event
                select_event(0);
            }
        );
    }
});

Vue.component("visualisation", {
    template : `
    <div id="visualisation" class="container-fluid">
        <div class="vis-on" v-if="dataReady">
            <div class="col-sm-3">
                <div class="panel panel-info">
                  <div class="panel-heading">Symbolic Control-Flow Graph</div>
                  <div class="panel-body">
                    <scfg></scfg>
                  </div>
                </div>
            </div>

            <div class="col-sm-5">
                <div class="panel panel-info">
                  <div class="panel-heading">Query</div>
                  <div class="panel-body" id="query" v-html="store.current_specification">
                  </div>
                </div>

                <div class="panel panel-info">
                  <div class="panel-heading">Code - <b>{{ store.current_function }}</b></div>
                  <div class="panel-body" id="code">
                    <table>
                        <tr class="code-line-skip" v-if="store.current_code_listing[0].number > 1">
                            <td class="number"></td>
                            <td class="code-wrapper">...</td>
                        </tr>
                        <tr class="code-line" v-for="line in store.current_code_listing"
                            v-bind:class="getLineHighlightStatus(line.number)">
                            <td class="number">{{ line.number }}</td>
                            <td class="code-wrapper"><pre class="code">{{ line.code }}</pre></td>
                        </tr>
                    </table>
                  </div>
                </div>
            </div>

            <div class="col-sm-4">
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
    },
    methods : {
        getLineHighlightStatus : function(line_number) {
            if(Store.highlighted_line_number == line_number) {
                return "highlighted";
            } else return ""
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
                g.setEdge(scfg[i].id, scfg[i].children[j], {curve: d3.curveBasis});
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
    template : `<div class="binding-tree">
        <svg id="binding-tree" height="0" width="0"><g></g></svg>
        <p v-if="bindings_empty">No bindings to display</p>
    </div>`,
    data : function() {
        return {
            store : Store
        }
    },
    computed : {
        bindings_empty : function() {
            return this.store.binding_trees.length == 0;
        }
    }
});

var app = new Vue({
    el : "#app"
});