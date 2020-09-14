# VyPR Web-based Visualisation Tool

A Javascript-based visualisation tool for the VyPR performance analysis framework.

Runs alongside VyPR's analysis server, using:
 * Python with Flask for a server.
 * Javascript with Vue.js for front-end.
 * Dagre (based on d3) for drawing directed graphs.

##  Setup

You will need three terminals open.  One for the VyPR verdict server, one for the visualisation tool server, and one
for the test project whose execution will be visualised.

#### Terminal 1 - Visualisation Tool

Clone the visualisation tool into a new directory
```
git clone git@github.com:pyvypr/VyPR-visualisation.git
```
Navigate into the new directory and set up a virtual environment
```
virtualenv --python=python2.7 venv
```
activate it
```
source venv/bin/activate
```
and install the requirements ``pip install -r requirements.txt``.

#### Terminal 2 - Verdict Server

From the root directory of the visualisation tool, clone the VyPR verdict server
```
git clone git@github.com:pyvypr/VyPRServer.git
```
Navigate into that directory and set up the databases required by the VyPR verdict server for the visualisation tool to work:
```
source setup_dbs
``` 
Then, set up a virtual environment
```
virtualenv --python=python2.7 venv
```
activate it
```
source venv/bin/activate
```
and install the requirements ``pip install -r requirements.txt``.

Finally, you need to clone VyPR into the verdict server's root directory since the server relies on some code from it
```
git clone git@github.com:pyvypr/VyPR.git
```
You don't need to install any requirements for this.

To launch the verdict server, run
```
python run_service.py --port 9002 --db verdicts.db --events-db events.db --path <visualisation tool root>/test-project/
```

#### Terminal 3 - Generating the visualisation

Navigate to the directory `test-project` in the root directory of the visualisation tool.

Set up a virtual environment
```
virtualenv --python=python2.7 venv
```
activate it
```
source venv/bin/activate
```
and install the requirements ``pip install -r requirements.txt``.

Now, clone the distribution of VyPR designed for *short-running* programs
```
git clone git@github.com:pyvypr/VyPRLocal-py2.git VyPR
```

With VyPR cloned, instrument the sample project with respect to the queries provided in `VyPR_queries.py` with
```
python VyPR/instrument.py
```
Then run the instrumented code with
```
python main.py
```
This will generate verdict data with respect to the queries in `VyPR_queries.py`.

The visualisation data is now generated, so you need to launch the visualisation tool to display it.  In the terminal
in which you set up the visualisation tool, run
```
python launch.py --port 8080 --instrumentation-stream http://localhost:9002/event_stream/instrumentation/ \
--monitoring-stream http://localhost:9002/eventtream/monitoring/
```

Launch the visualisation tool with, for example,
`python launch.py --port 9000 --instrumentation-stream http://.../event_stream/instrumentation/ --monitoring-stream http://.../event_stream/monitoring/`
With the visualisation tool launched, `http://localhost:9000/` in your browser and go from there.