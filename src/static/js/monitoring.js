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
    play_interval : null,
    instrumentation_tree : null
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
    if(direction == "forwards") {
    } else if(direction == "backwards") {
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
                        <tr class="code-line-skip" v-if="this.currentCodeListing[0].number > 1">
                            <td class="number"></td>
                            <td class="code-wrapper">...</td>
                        </tr>
                        <tr class="code-line" v-for="line in this.currentCodeListing"
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
                  </div>
                </div>

                <div class="panel panel-info">
                  <div class="panel-heading">Formula Trees</div>
                  <div class="panel-body">
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