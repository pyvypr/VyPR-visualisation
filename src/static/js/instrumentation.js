var Store = {
    events : [],
    current_event_index : 0
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
                    <td v-for="(event, index) in events">
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
            events : Store.events,
            selectedEventIndex : null,
        }
    },
    methods : {
        handlerEventClick : function(e, index, action, data) {
        }
    },
    props : ["event_stream"],
    mounted : function() {
        var that = this;
        axios.get(this.event_stream).then(
            function(response) {
                // add event data to property which is bound to html
                that.events = response.data;
            }
        );
    }
});

Vue.component("visualisation", {
    template : `
    <div id="visualisation" class="container">
        <div class="col-md-5">
            <div class="panel panel-default">
              <div class="panel-heading">Code</div>
              <div class="panel-body" id="code">
              </div>
            </div>
            <div class="panel panel-default">
              <div class="panel-heading">Symbolic Control-Flow Graph</div>
              <div class="panel-body" id="scfg">
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
    `
});

var app = new Vue({
    el : "#app"
});