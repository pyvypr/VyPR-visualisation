var Store = {
    events : [],
    current_event_index : 0
};

Vue.component("timeline", {
    template : '<div><button v-on:click="closeEventStream()">stop events</button><p>Timeline:</p><div><span v-for="event in events">{{ event }}, </span></div></div>',
    data : function() {
        return {
            events : Store.events,
            stream : null
        }
    },
    props : ["event_stream"],
    mounted : function() {
        var that = this;
        this.stream = new EventSource(this.event_stream);
        this.stream.onmessage = function(e) {
            Store.events.push(e.data);
        };
    },
    methods : {
        closeEventStream : function() {
            alert("closing event stream");
            this.stream.close();
        }
    }
});

Vue.component("visualisation", {
    template : '<div><p>Visualisation area</p></div>'
});

var app = new Vue({
    el : "#app"
});