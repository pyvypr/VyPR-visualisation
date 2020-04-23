var Store = {
    events : [],
    current_event_index : 0
};

Vue.component("timeline", {
    template : '<div><p>Timeline:</p><div><span v-for="event in events">{{ event }}, </span></div></div>',
    data : function() {
        return {
            events : Store.events
        }
    },
    props : ["event_stream"],
    mounted : function() {
        var that = this;
        var eventSource = new EventSource(this.event_stream);
        eventSource.onmessage = function(e) {
            Store.events.push(e.data);
        };
    }
});

Vue.component("visualisation", {
    template : '<div><p>Visualisation area</p></div>'
});

var app = new Vue({
    el : "#app"
});