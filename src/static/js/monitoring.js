var Store = {
    events : [],
    id_to_event : {},
    selected_event_index : null,
    highlighted_line_number : null,
    highlighted_spec_variable : null,
    current_code_listing : [],
    current_function : null,
    most_recent_function_start_event_index : null,
    formula_trees : [],
    atom_lists : [],
    property_binding_maps : [],
    most_recent_instrument_fired : null,
    play_interval : null
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
    while(Store.events[begin_function_event_index].action_to_perform != 'function-start') {
        begin_function_event_index--;
    }
    Store.most_recent_function_start_event_index = begin_function_event_index;
    // display the code listing
    var function_begin_event = Store.events[begin_function_event_index];
    Store.current_code_listing = function_begin_event.data.code;
    Store.current_specification = function_begin_event.data.specification;
    Store.current_bindings = function_begin_event.data.bindings;
    // check if the function has been changed
    var function_changed =
        (Store.events[begin_function_event_index].data.function != Store.current_function);
    if(function_changed) {
        // set the current function name
        Store.current_function = Store.events[begin_function_event_index].data.function;
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
    var data = event.data;
    if(direction == "forwards") {
        if(event.action_to_perform == "trigger-new-monitor") {
            Store.most_recent_instrument_fired = event;
            // add a new formula tree to the list of monitors
            Store.formula_trees.push(data.formula_tree);
            // set up a new assignment of atoms to observed values
            Store.atom_lists.push(data.atoms);
            // add a new property/binding pair so Vue can detect that
            Store.property_binding_maps.push(
                {property_hash : data.property_hash, binding_index : data.binding_index}
            );
            var formula_tree_index = Store.formula_trees.length-1;
            // add new formula tree element to DOM in next tick
            Vue.nextTick(function() {
                var graph_div = document.createElement("div");
                graph_div.className = "formula_tree";
                var graph_svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
                graph_svg.id = data.property_hash + "-" + data.binding_index + "-" + formula_tree_index;
                graph_svg.innerHTML = "<g></g>";
                $("#" + data.property_hash + "-" + data.binding_index).append(graph_div);
                graph_div.append(graph_svg);
                // render the formula tree
                render_formula_tree(data.property_hash, data.binding_index, formula_tree_index);
            });

        } else if(event.action_to_perform == "receive-measurement") {
            Store.most_recent_instrument_fired = event;
            for(var i=0; i<Store.property_binding_maps.length; i++) {
                if(Store.property_binding_maps[i].property_hash == data.property_hash &&
                    Store.property_binding_maps[i].binding_index == data.binding_index) {
                    // update the formula tree
                    // TODO: update to deal with mixed atoms
                    console.log("updating state of formula tree " + i);
                    // update the value to which the relevant atom is mapped
                    Store.atom_lists[i][data.atom_index] = data.observed_value;
                    // update the formula tree with the values held in the atoms list
                    interpret_formula_tree(Store.formula_trees[i], Store.atom_lists[i]);
                    // render the formula tree
                    render_formula_tree(data.property_hash, data.binding_index, i);
                }
            }
        } else if(event.action_to_perform == "collapse-monitor") {
            alert("processing collapse monitor event");
            // the formula tree index given by VyPR is local to the property/binding pair,
            // so we have to iterate through the global list and keep a count to determine which
            // formula tree corresponds to the local index given
            var local_count = 0;
            for(var i=0; i<Store.property_binding_maps.length; i++) {
                if(Store.property_binding_maps[i].property_hash == data.property_hash &&
                    Store.property_binding_maps[i].binding_index == data.binding_index) {
                    if(local_count == data.formula_tree_index) {
                        Store.formula_trees[i].verdict = data.verdict;
                        var global_formula_tree_index = i;
                    } else {
                        local_count++;
                    }
                }
            }
            Vue.nextTick(function () {
                // add the verdict to the relevant formula tree container
                $("#" + data.property_hash + "-" + data.binding_index + "-" + global_formula_tree_index)
                    .parent().html("<div class='verdict'>" + data.verdict + "</div>");
            });
        }
    } else if(direction == "backwards") {
    }
};

var interpret_formula_tree = function(formula_tree, atom_assignments) {
    // for a given set of atom assignments, recursively compute the version of the
    // formula tree with atoms replaced by those assignments
    console.log("interpreting formula tree with respect to assignment " + atom_assignments);
    if(formula_tree.type == "atom") {
        // replace the atom with the value held in the assignment
        formula_tree.value = atom_assignments[formula_tree.atom_index];
        // mark the atom as evaluated
        formula_tree.type = "evaluated";
    }
};

var render_formula_tree = function(property_hash, binding_index, formula_tree_index) {
    // render the formula tree at the given index that we have for the given property_hash/binding_index combination
    // Note: the formula_tree_index given is the index in the global list of formula trees
    // set up the svg container for the graph

    // construct the graph
    var g = new dagreD3.graphlib.Graph().setGraph({rankdir: 'LR'});
    var formula_tree =  Store.formula_trees[formula_tree_index];

    // we now recursively traverse the formula tree to add to the graph
    build_graph(g, formula_tree);

    // render the graph
    var svg = d3.select("#" + property_hash + "-" + binding_index + "-" + formula_tree_index),
    inner = svg.select("g");

    // remove all content before rendering anything new
    inner.selectAll("*").remove();

    // Create the renderer
    var render = new dagreD3.render();

    // Run the renderer. This is what draws the final graph.
    render(inner, g);

    svg.attr('height', g.graph().height);
    svg.attr('width', g.graph().width);

    // give correct size to parent formula tree wrapper
    $("#" + property_hash + "-" + binding_index + "-" + formula_tree_index).parent().width(g.graph().width);
    $("#" + property_hash + "-" + binding_index + "-" + formula_tree_index).parent().height(g.graph().height);
};

var build_graph = function(graph, subtree) {
    // recursive through a formula tree, adding to the graph as we go
    if(subtree.type == "atom" || subtree.type == "evaluated") {
        // TODO: update to deal with mixed atoms
        graph.setNode(
            subtree.atom_index,
            {label : subtree.value, width : subtree.value.length*5 + 10, height: 20}
        );
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
                that.store.events = response.data.events;
                // build the event index
                for(var i=0; i<that.store.events.length; i++) {
                    that.store.id_to_event[that.store.events[i].id] = that.store.events[i];
                }
                // set starting code listing
                that.store.function_to_code_map = response.data.code_map;
                // select the first event
                select_event(0);
            }
        );
    }
});

Vue.component("instrument-fired", {
    template : `
    <div class="instrument-fired">
        <div v-if="instrumentHasFired">
            <div v-if="mostRecentInstrument.action_to_perform == 'trigger-new-monitor'">
                <p><b>Trigger for a new monitor</b></p>
                <p><b>Property hash:</b> {{ mostRecentInstrument.data.property_hash }}</p>
                <p><b>Index of binding:</b> {{ mostRecentInstrument.data.binding_index }}</p>
                <p><b>Observed values to copy:</b>
                 {{ mostRecentInstrument.data.observed_values }}</p>
                <p><b>Variable index:</b> {{ mostRecentInstrument.data.variable_index }}</p>
            </div>
            <div v-else-if="mostRecentInstrument.action_to_perform == 'receive-measurement'">
                <p><b>Update a monitor with a measurement</b></p>
                <p><b>Property hash:</b> {{ mostRecentInstrument.data.property_hash }}</p>
                <p><b>Index of binding:</b> {{ mostRecentInstrument.data.binding_index }}</p>
                <p><b>Atom and sub-atom indices:</b> {{ mostRecentInstrument.data.atom_index }},
                {{ mostRecentInstrument.data.atom_sub_index }}</p>
                <p><b>Measurement </b>
                 {{ mostRecentInstrument.data.observed_value }}<b> starting from </b>
                 {{ mostRecentInstrument.data.observation_start_time }}<b> and ending at </b>
                 {{ mostRecentInstrument.data.observation_end_time }}</p>
            </div>
        </div>
        <div v-else>
            <p>No instrument has fired yet.</p>
        </div>
    </div>
    `,
    data : function() {
        return {
            store : Store
        }
    },
    computed : {
        instrumentHasFired : function() {
            return this.store.most_recent_instrument_fired != null;
        },
        mostRecentInstrument : function() {
            return this.store.most_recent_instrument_fired;
        }
    }
});

Vue.component("formula-trees", {
    template : `
    <div class="formula-tree-list">
        <ul v-for="(binding_index_list, property_hash) in monitorTree">
            <li>
            <div class="property-hash">{{ property_hash }}</div>
            <ul v-for="binding_index in binding_index_list">
                <div class="binding">Binding - lines {{ store.current_bindings[binding_index] }}</div>
                <div class="formula_trees" v-bind:id="canvasID(property_hash, binding_index)"></div>
            </ul>
            </li>
        </ul>
    </div>
    `,
    data : function() {
        return {
            store : Store
        };
    },
    methods : {
        canvasID : function(property_hash, binding_index) {
            return property_hash + "-" + binding_index;
        }
    },
    computed : {
        monitorTree : function() {
            var tree = {};
            for(var index in Store.property_binding_maps) {
                var property_hash = Store.property_binding_maps[index].property_hash;
                var binding_index = Store.property_binding_maps[index].binding_index;
                if(!(property_hash in tree)) {
                    tree[property_hash] = [binding_index];
                } else {
                    if(!(binding_index in tree[property_hash])) {
                        tree[property_hash].push(binding_index);
                    }
                }
            }
            return tree;
        },

    }
});

Vue.component("visualisation", {
    template : `
    <div id="visualisation" class="container-fluid">
        <div class="vis-on" v-if="dataReady">
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
                        <tr class="code-line-skip" v-if="currentCodeListing[0].number > 1">
                            <td class="number"></td>
                            <td class="code-wrapper">...</td>
                        </tr>
                        <tr class="code-line" v-for="line in currentCodeListing"
                            v-bind:class="getLineHighlightStatus(line.number)">
                            <td class="number">{{ line.number }}</td>
                            <td class="code-wrapper"><pre class="code">{{ line.code }}</pre></td>
                        </tr>
                    </table>
                  </div>
                </div>
            </div>

            <div class="col-sm-7">
                <div class="panel panel-info">
                  <div class="panel-heading">Most Recent Instrument Fired</div>
                  <div class="panel-body">
                    <instrument-fired></instrument-fired>
                  </div>
                </div>

                <div class="panel panel-info">
                  <div class="panel-heading">Monitor Instances</div>
                  <div class="panel-body">
                    <formula-trees></formula-trees>
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
        },
        currentCodeListing : function() {
            return this.store.function_to_code_map[this.store.current_function];
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

var app = new Vue({
    el : "#app"
});