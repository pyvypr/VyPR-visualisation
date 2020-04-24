"""
The main module for the visualisation tool.
Here, we will start up a local Flask-based web service that can be accessed at localhost with a configurable port.
"""
import argparse
import time
from flask import Flask, Response, render_template

# set up command line arguments
parser = argparse.ArgumentParser(prog="VyPR Visualisation Tool")
parser.add_argument("--port", required=True, type=int, help="The local port on which to run the tool.")
parser.add_argument("--instrumentation-stream", required=True, type=str,
                    help="The URL of the instrumentation event stream to use.")
parser.add_argument("--monitoring-stream", required=True, type=str,
                    help="The URL of the monitoring event stream to use.")
args = parser.parse_args()


def stream_generator(mode):
    """
    Generates a stream.
    :return: event stream.
    """
    rows = ["%s event %i" % (mode, i) for i in range(100)]
    for row in rows:
        yield "data: %s\n\n" % row
        time.sleep(1)


def create_app(inst_event_stream_url, mon_event_stream_url):
    """
    Flask app factory.
    :return:
    """
    app = Flask(__name__)

    @app.route("/", methods=["GET"])
    def index():
        """
        Index end-point.
        """
        return render_template(
            "index.html",
            inst_event_stream_url=inst_event_stream_url,
            mon_event_stream_url=mon_event_stream_url)

    @app.route("/instrumentation/", methods=["GET"])
    def instrumentation():
        """
        Instrumentation visualisation end-point.
        """
        return render_template("instrumentation.html", event_stream_url=inst_event_stream_url)

    @app.route("/monitoring/", methods=["GET"])
    def monitoring():
        """
        Monitoring visualisation end-point.
        """
        return render_template("monitoring.html", event_stream_url=mon_event_stream_url)

    return app


if __name__ == "__main__":
    app = create_app(args.instrumentation_stream, args.monitoring_stream)
    app.run(host="0.0.0.0", port=args.port, debug=True)
