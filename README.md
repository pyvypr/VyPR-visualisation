# VyPR Web-based Visualisation Tool

In development.

A Javascript-based visualisation tool for the VyPR performance analysis framework.

Runs alongside VyPR's analysis server, using:
 * Python with Flask for a server.
 * Javascript with Vue.js for front-end.
 * Dagre (based on d3) for drawing directed graphs.

##  Setup (currently vague)

1) Run ``pip install -r requirements``.
2) Set up VyPR's verdict server, launch it and instrument the service under scrutiny.
3) Launch the visualisation tool with, for example,
`python launch.py --port 9000 --instrumentation-stream http://.../event_stream/instrumentation/ --monitoring-stream http://.../event_stream/monitoring/`
4) With the visualisation tool launched, `http://localhost:9000/` in your browser and go from there.