var Store = {
    events : [],
    id_to_event : {},
    selected_event_index : null,
    highlighted_line_number : null,
    highlighted_spec_variable : null,
    current_code_listing : [],
    current_function : null,
    variables : [],
    most_recent_function_start_event_index : null,
    formula_trees : [],
    atom_lists : [],
    property_binding_maps : [],
    most_recent_instrument_fired : null,
    play_interval : null
};

var reset_store = function(store) {
    Store.selected_event_index = null;
    Store.highlighted_line_number = null;
    Store.highlighted_spec_variable = null;
    Store.current_code_listing = [];
    Store.current_function = null;
    Store.most_recent_function_start_event_index = null;
    // delete from the formula trees list
    //Store.formula_trees.splice(0, Store.formula_trees.length);
    Store.formula_trees = [];
    // delete from the list of atom lists
    //Store.atom_lists.splice(0, Store.atom_lists.length);
    Store.atom_lists = [];
    // delete from the maps list
    //Store.property_binding_maps.splice(0, Store.property_binding_maps.length);
    Store.property_binding_maps = [];
    Store.most_recent_instrument_fired = null;
    Store.play_interval = null;
};

var resetAtomHighlighting = function() {
    $(".atom").removeClass("highlight");
    $(".subatom").removeClass("highlight");
    $(".variable-def").removeClass("highlight");
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
    Store.current_variables = function_begin_event.data.variables;
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
            apply_event(Store.events[i]);
        }
    } else if(start_index > end_index) {
        // replay backwards in time
        // to do this, we determine the previous event, wipe the state and then replay from the start
        // to the previous event
        reset_store();
        select_event(end_index);
        // call reset here just in case there are no events to apply
        resetAtomHighlighting();
        for(var i=1; i<=end_index; i++) {
            apply_event(Store.events[i]);
        }
    }
};

var apply_event = function(event) {
    // event is a dictionary with an action and data
    // direction is always forwards for monitoring because information is often deleted so to reconstruct it
    // we have to replay the whole monitoring process.
    resetAtomHighlighting();
    var data = event.data;
    if(event.action_to_perform == "trigger-new-monitor") {
        Store.most_recent_instrument_fired = event;
        // highlight the variable
        resetAtomHighlighting();
        $(".variable-def[variable=" + event.data.variable_index + "]").addClass("highlight");
        // add a new formula tree to the list of monitors by copy
        formula_tree_copy = JSON.parse(JSON.stringify(data.formula_tree));
        Store.formula_trees.push(formula_tree_copy);
        // set up a new assignment of atoms to observed values by copy
        Store.atom_lists.push(data.atoms.slice());
        // add a new property/binding pair so Vue can detect that
        Store.property_binding_maps.push(
            {property_hash : data.property_hash, binding_index : data.binding_index}
        );
        console.log(Store.property_binding_maps);
        var formula_tree_index = Store.formula_trees.length-1;
        // check whether this formula tree is the first for this binding
        var n_formula_trees = 0;
        for(var i=0; i<Store.property_binding_maps.length; i++) {
            if(Store.property_binding_maps[i].property_hash == data.property_hash &&
                Store.property_binding_maps[i].binding_index == data.binding_index) {
                n_formula_trees++;
            }
        }
        console.log(n_formula_trees + " found for binding " + data.binding_index);
        // add new formula tree element to DOM in next tick
        Vue.nextTick(function() {
            // if this is the first formula tree, first remove all existing content (we need to do this
            // if we're going backwards)
            if(n_formula_trees == 1) {
                console.log("adding first formula tree");
                $("#" + data.property_hash + "-" + data.binding_index).empty();
            }
            // if the formula tree doesn't exist, add it
            if($("#" + data.property_hash + "-" + data.binding_index + "-" + formula_tree_index).length == 0) {
                // if the formula tree wasn't found, put it on the page
                var graph_div = document.createElement("div");
                graph_div.className = "formula_tree";
                var graph_svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
                graph_svg.id = data.property_hash + "-" + data.binding_index + "-" + formula_tree_index;
                graph_svg.innerHTML = "<g></g>";
                $("#" + data.property_hash + "-" + data.binding_index).append(graph_div);
                console.log("adding formula tree to end");
                graph_div.append(graph_svg);
                // add verdict panel
                var verdict_panel = document.createElement("div");
                verdict_panel.className = "verdict";
                graph_div.append(verdict_panel);
            }
            // render the formula tree
            render_formula_tree(data.property_hash, data.binding_index, formula_tree_index);
        });
        // finally, highlight the triggering line number in the source code
        Store.highlighted_line_number = Store.current_bindings[data.binding_index][data.variable_index]

    } else if(event.action_to_perform == "receive-measurement") {
        Store.most_recent_instrument_fired = event;
        for(var i=0; i<Store.property_binding_maps.length; i++) {
            if(Store.property_binding_maps[i].property_hash == data.property_hash &&
                Store.property_binding_maps[i].binding_index == data.binding_index) {
                // update the line number highlighting
                Store.highlighted_line_number = data.line_number;
                // highlight the relevant atom/sub-atom in the specification
                resetAtomHighlighting();
                $(".atom[atom-index=" + data.atom_index + "]").toggleClass("highlight");
                $(".subatom[subatom-index=" + data.atom_sub_index + "]").toggleClass("highlight");
                // update the value to which the relevant atom is mapped
                if(Store.formula_trees[i].type == "mixed-atom") {
                    Store.atom_lists[i][data.atom_index][data.atom_sub_index] = data.observed_value;
                } else {
                    Store.atom_lists[i][data.atom_index] = data.observed_value;
                }
                // update the formula tree with the values held in the atoms list
                interpret_formula_tree(
                    Store.formula_trees[i],
                    Store.atom_lists[i],
                    data.atom_index,
                    data.atom_sub_index
                );
                // render the formula tree
                render_formula_tree(data.property_hash, data.binding_index, i);
            }
        }
    } else if(event.action_to_perform == "collapse-monitor") {
        Store.most_recent_instrument_fired = event;
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
            console.log(data.verdict);
            $("#" + data.property_hash + "-" + data.binding_index + "-" + global_formula_tree_index)
                .parent().addClass(String(data.verdict));
            var verdict_panel = $("#" + data.property_hash + "-" + data.binding_index + "-" + global_formula_tree_index)
                .parent().find(".verdict");
            verdict_panel.html(String(data.verdict));
            verdict_panel.css({
                width: $("#" + data.property_hash + "-" + data.binding_index + "-" + global_formula_tree_index)
                .parent().outerWidth(),
                height: $("#" + data.property_hash + "-" + data.binding_index + "-" + global_formula_tree_index)
                .parent().outerHeight(),
                "margin-top": -1 * $("#" + data.property_hash + "-" + data.binding_index + "-" + global_formula_tree_index)
                .parent().outerHeight(),
                "padding-top": 0.35 * $("#" + data.property_hash + "-" + data.binding_index + "-" + global_formula_tree_index)
                .parent().outerHeight()
            });
        });
    }
};

var interpret_formula_tree = function(formula_tree, atom_assignments, atom_index, atom_sub_index) {
    // for a given set of atom assignments, recursively compute the version of the
    // formula tree with atoms replaced by those assignments
    if(formula_tree.type == "atom" && formula_tree.atom_index == atom_index) {
        // replace the atom with the value held in the assignment
        formula_tree.value = atom_assignments[atom_index];
        // mark the atom as evaluated
        formula_tree.type = "evaluated";
    } else if(formula_tree.type == "mixed-atom" && formula_tree.atom_index == atom_index) {
        console.log("interpreting mixed atom");
        console.log(atom_sub_index);
        if(atom_sub_index == 0) {
            // update lhs
            formula_tree.lhs.value = atom_assignments[atom_index][atom_sub_index];
        } else if(atom_sub_index == 1) {
            // update rhs
            formula_tree.rhs.value = atom_assignments[atom_index][atom_sub_index];
        }
    }
};

var render_formula_tree = function(property_hash, binding_index, formula_tree_index) {
    // render the formula tree at the given index that we have for the given property_hash/binding_index combination
    // Note: the formula_tree_index given is the index in the global list of formula trees
    // set up the svg container for the graph

    // construct the graph
    var g = new dagreD3.graphlib.Graph().setGraph({rankdir: 'TB', nodesep: 10});
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
        graph.setNode(
            subtree.atom_index,
            {label : subtree.value, width : subtree.value.length*5 + 10, height: 20}
        );
    } else if(subtree.type == "mixed-atom") {
        // mixed atoms make subtrees, so construct root node
        graph.setNode(
            subtree.atom_index,
            {label : subtree.value, width : subtree.value.length*5 + 10, height: 20}
        );
        // construct child nodes
        graph.setNode(
            subtree.atom_index + "-0",
            {label : subtree.lhs.value, width : subtree.lhs.value.length*6 + 15, height: 20}
        );
        graph.setNode(
            subtree.atom_index + "-1",
            {label : subtree.rhs.value, width : subtree.rhs.value.length*6 + 15, height: 20}
        );
        // add edges
        graph.setEdge(subtree.atom_index, subtree.atom_index + "-0", {});
        graph.setEdge(subtree.atom_index, subtree.atom_index + "-1", {});
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
                apply_event(this.store.events[this.store.selected_event_index]);
            }
        },
        handlerPreviousEvent : function(e) {
            if(this.store.selected_event_index != 0 && this.store.play_interval == null) {
                var previous_event_index = this.store.selected_event_index;
                select_event(this.store.selected_event_index-1);
                console.log([previous_event_index, this.store.selected_event_index]);
                replay_events(previous_event_index, this.store.selected_event_index);
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
                <div class="info-panel">
                    <p>VyPR places additional code in a monitored program in order to get the data it needs
                    to resolve the query given by an engineer.</p>
                    <p>This instrument has told VyPR that it should instantiate a new formula tree whose
                    structure reflects the quantifier-free part of the query given.</p>
                    <p v-if="mostRecentInstrument.data.variable_index == 0">In this case, a clean monitor will be instantiated
                    since the instrument was placed for the first variable.</p>
                    <p v-else>In this case, a monitor will be instantiated by copying state from existing monitors
                    since the instrument was placed for a variable that was not the first, so there may have been
                    information observed for previous variables.</p>
                </div>

                <p><b>Trigger for a new monitor</b></p>
                <!--<p><b>Property hash:</b> {{ mostRecentInstrument.data.property_hash }}</p>-->
                <!--<p><b>Generating source code line:</b>
                {{ store.current_bindings[mostRecentInstrument.data.binding_index]
                    [mostRecentInstrument.data.variable_index] }}
                </p>-->
                <p><b>Variable matched:</b> {{ store.current_variables[mostRecentInstrument.data.variable_index] }}</p>
                <p><b>Observed values to copy:</b>
                 {{ mostRecentInstrument.data.observed_values }}</p>
            </div>
            <div v-else-if="mostRecentInstrument.action_to_perform == 'receive-measurement'">

                <div class="info-panel">
                    <p>VyPR places additional code in a monitored program in order to get the data it needs
                    to resolve the query given by an engineer.</p>
                    <p>This instrument has given VyPR a measurement with which to update existing monitors.  The instrument
                    received also included information on 1) which formula trees to update and 2) which parts of them to update.
                    This removes the need for the monitoring algorithm to perform its own lookup.</p>
                </div>

                <p><b>Update a monitor with a measurement</b></p>
                <!--<p><b>Property hash:</b> {{ mostRecentInstrument.data.property_hash }}</p>-->
                <!--<p><b>Relevant source code line:</b> {{ mostRecentInstrument.data.line_number }}-->
                </p>
                <!--<p><b>Atom/sub-atom indices:</b> {{ mostRecentInstrument.data.atom_index }} /
                {{ mostRecentInstrument.data.atom_sub_index }}</p>-->
                <p><b>Measurement </b>
                 {{ mostRecentInstrument.data.observed_value }}<b> starting from </b>
                 {{ mostRecentInstrument.data.observation_start_time }}<b> and ending at </b>
                 {{ mostRecentInstrument.data.observation_end_time }}</p>
            </div>
            <div v-else-if="mostRecentInstrument.action_to_perform == 'collapse-monitor'">

                <div class="info-panel">
                    <p>VyPR places additional code in a monitored program in order to get the data it needs
                    to resolve the query given by an engineer.</p>
                    <p>When enough information is received from the program to conclude that the constraint expressed by
                    a formula tree is satisfied or not, that formula tree is collapsed to the representative truth value.</p>
                </div>

                <p><b>Collapse a monitor to a verdict</b></p>
                <!--<p><b>Property hash:</b> {{ mostRecentInstrument.data.property_hash }}</p>-->
                <p><b>Index of binding:</b> {{ mostRecentInstrument.data.binding_index }}</p>
                <p><b>Formula tree local index:</b> {{ mostRecentInstrument.data.formula_tree_index }}</p>
                <p><b>Verdict: </b> {{ mostRecentInstrument.data.verdict }}</p>
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
        <div class="info-panel">
            <p>The current state held by the monitoring algorithm.</p>
            <p>Each pair of events matching the quantifiers in the query generates a <i>formula tree</i>
            here.  Formula trees are grouped by the pairs of statements in code that generated
            the relevant events.</p>
            <p>As measurements are received from instruments, the formula trees collapse to truth values.</p>
        </div>
        <p v-if="monitorTreeEmpty">
            No monitoring state exists yet.
        </p>
        <ul v-else v-for="(binding_index_list, property_hash) in monitorTree">
            <li v-for="binding_index in binding_index_list">
                <div class="binding">Monitors triggered by lines {{ store.current_bindings[binding_index] }}</div>
                <div class="formula_trees" v-bind:id="canvasID(property_hash, binding_index)"></div>
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
        monitorTreeEmpty : function() {
            return Store.property_binding_maps.length == 0;
        },
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
                  <div class="panel-heading">
                    Run of <b>{{ store.current_function }}</b>
                    <a class="badge" @mouseover="toggleInfo($event)" @mouseout="toggleInfo($event)">?</a>
                  </div>
                  <div class="panel-body" id="code">
                    <!--<div class="info-panel">
                      <p>The function in source code that was monitored by VyPR at runtime.</p>
                      <p>As monitoring progresses, the statements at which measurements were made at runtime
                      are highlighted here.</p>
                    </div>-->
                    <instrument-fired></instrument-fired>
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
                  <div class="panel-heading">
                    Monitor Instances
                    <a class="badge" @mouseover="toggleInfo($event)" @mouseout="toggleInfo($event)">?</a>
                  </div>
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
                return "highlight";
            } else return ""
        },
        toggleInfo : function(e) {
          $(e.target).toggleClass("active");
          var info_panel = $(e.target).parent().parent().find(".info-panel");
          info_panel.fadeToggle();
          info_panel.css({
            "margin-left" : ($(e.target).parent().parent().outerWidth()-info_panel.outerWidth()-32) + "px"
          });
        }
    }
});

var app = new Vue({
    el : "#app"
});