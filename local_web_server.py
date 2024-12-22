# in this section, this wraps the data collection layer, exposing APIs to the UI
# it handles requests for data, notes, and visualization updates

from flask import Flask, jsonify, request
from processing_engine import ProcessingEngine


# API workflow
# Frontend requests data for visualization
# user adds a note via the UI
# Data refresh is triggered manually


# Initialize the Flask application and the Processing Engine
app = Flask(__name__)
engine = ProcessingEngine()

@app.route("/")
def welcome():
    return jsonify({
        "message": "Welcome to the Activity Tracker API!",
        "endpoints": {
            "/daily_breakdown": "Get the activity breakdown for a single day",
            "/overview": "Get activity overview for a date range",
            "/flow_states": "Get flow state analysis for a date range",
        }
    })

@app.route("/daily_breakdown", methods=["GET"])
def daily_breakdown():
    """
    Endpoint: /daily_breakdown
    Query Parameters:
        - date (required): The date for which the breakdown is needed (YYYY-MM-DD).
    """
    date = request.args.get("date")
    if not date:
        return jsonify({"error": "Missing required parameter: date"}), 400

    try:
        breakdown = engine.generate_daily_breakdown(date)
        return jsonify(breakdown)
    except Exception as e:
        return jsonify({"error": f"An error occurred: {str(e)}"}), 500

@app.route("/overview", methods=["GET"])
def overview():
    """
    Endpoint: /overview
    Query Parameters:
        - start_date (required): Start of the date range (YYYY-MM-DD).
        - end_date (required): End of the date range (YYYY-MM-DD).
    """
    start_date = request.args.get("start_date")
    end_date = request.args.get("end_date")

    if not start_date or not end_date:
        return jsonify({"error": "Missing required parameters: start_date, end_date"}), 400

    try:
        overview_data = engine.generate_overview(start_date, end_date)
        return jsonify(overview_data)
    except Exception as e:
        return jsonify({"error": f"An error occurred: {str(e)}"}), 500

@app.route("/flow_states", methods=["GET"])
def flow_states():
    """
    Endpoint: /flow_states
    Query Parameters:
        - start_date (required): Start of the date range (YYYY-MM-DD).
        - end_date (required): End of the date range (YYYY-MM-DD).
        - typing_threshold (optional): Minimum keystrokes per period to count as flow (default=20).
    """
    start_date = request.args.get("start_date")
    end_date = request.args.get("end_date")
    typing_threshold = request.args.get("typing_threshold", default=20, type=int)

    if not start_date or not end_date:
        return jsonify({"error": "Missing required parameters: start_date, end_date"}), 400

    try:
        flow_data = engine.calculate_flow_states(start_date, end_date, typing_threshold)
        return jsonify({"flow_states": flow_data})
    except Exception as e:
        return jsonify({"error": f"An error occurred: {str(e)}"}), 500

if __name__ == "__main__":
    app.run(port=5000, debug=True)
