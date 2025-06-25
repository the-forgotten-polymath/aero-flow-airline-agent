from flask import Flask, render_template, request, jsonify, url_for, redirect
import os
import json
import uuid
from datetime import datetime
import dialogflow_api
import logging

app = Flask(__name__)
app.config['JSON_AS_ASCII'] = False
app.config['JSONIFY_MIMETYPE'] = 'application/json'
app.config['JSON_SORT_KEYS'] = False

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

global session_id
session_id = uuid.uuid4()

# Configuration
UPLOAD_FOLDER = 'static/uploads'
ALLOWED_EXTENSIONS = {'txt', 'pdf', 'png', 'jpg', 'jpeg', 'gif', 'doc', 'docx', 'xls', 'xlsx', 'mp3', 'wav', 'm4a'}

# Create upload folder if it doesn't exist
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max upload size

# Helper function to check allowed file extensions
def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

# Helper function to format response for voice users
def format_voice_response(text):
    """Format text response to be more natural for voice output"""
    # Remove excessive punctuation that doesn't sound natural
    voice_text = text.replace('*', '').replace('**', '')
    
    # Replace common abbreviations with full words for better pronunciation
    replacements = {
        'BA': 'British Airways',
        'UK': 'United Kingdom',
        'US': 'United States',
        'FAQ': 'frequently asked questions',
        'CEO': 'chief executive officer',
        'ATM': 'cash machine',
        'Wi-Fi': 'wireless internet',
        'COVID': 'coronavirus',
        'PCR': 'PCR test',
        'kg': 'kilograms',
        'cm': 'centimeters',
        'hrs': 'hours',
        'mins': 'minutes'
    }
    
    for abbrev, full_form in replacements.items():
        voice_text = voice_text.replace(abbrev, full_form)
    
    # Add natural speech patterns
    if voice_text.startswith('Here'):
        voice_text = voice_text.replace('Here', 'Here\'s what I found.', 1)
    
    return voice_text

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/my-trips')
def my_trips():
    return render_template('my-trips.html')

@app.route('/travel-information')
def travel_information():
    return render_template('travel-information.html')

@app.route('/destinations')
def destinations():
    return render_template('destinations.html')

@app.route('/executive-club')
def executive_club():
    return render_template('executive-club.html')

@app.route('/chat', methods=['POST'])
def chat():
    try:
        data = request.json
        if not data:
            return jsonify({"error": "No data received"}), 400

        message = data.get('message', '')
        is_voice_input = data.get('is_voice_input', False)
        
        if not message:
            return jsonify({"error": "No message provided"}), 400

        # Log the incoming message for debugging
        app.logger.info(f"Received message: {message} (Voice: {is_voice_input})")
        
        # Enhanced message preprocessing for voice input
        if is_voice_input:
            # Clean up common speech recognition errors
            message = preprocess_voice_message(message)
        
        # Send message to Dialogflow and get response
        dialogflow_response = dialogflow_api.run_sample([message], session_id)
        
        if not dialogflow_response or not dialogflow_response[0]:
            return jsonify({"error": "No response from Dialogflow"}), 500

        response_text = dialogflow_response[0]
        
        # Format response for voice if needed
        if is_voice_input:
            response_text = format_voice_response(response_text)
        
        # Enhanced response with context for voice users
        enhanced_response = enhance_response_for_voice(response_text, message, is_voice_input)
        
        return jsonify({
            "response": enhanced_response,
            "is_voice_response": is_voice_input,
            "original_response": dialogflow_response[0]
        })

    except Exception as e:
        app.logger.error(f"Error in chat endpoint: {str(e)}")
        error_message = "I apologize, but I'm having trouble processing your request right now. Please try again in a moment."
        return jsonify({"error": error_message}), 500

def preprocess_voice_message(message):
    """Clean up common speech recognition errors"""
    # Common speech-to-text corrections
    corrections = {
        'british airway': 'british airways',
        'british air way': 'british airways',
        'british airways airways': 'british airways',
        'book a flight': 'book flight',
        'i want to': 'i want to',
        'can you help me': 'help me',
        'what is': 'what\'s',
        'where is': 'where\'s',
        'how do i': 'how do I',
        'i need to': 'i need to'
    }
    
    cleaned_message = message.lower().strip()
    
    for wrong, correct in corrections.items():
        cleaned_message = cleaned_message.replace(wrong, correct)
    
    return cleaned_message

def enhance_response_for_voice(response, original_message, is_voice_input):
    """Enhance response with additional context for voice users"""
    
    if not is_voice_input:
        return response
    
    # Add conversational elements for voice interaction
    voice_starters = [
        "I'd be happy to help you with that.",
        "Let me assist you with that information.",
        "Here's what I can tell you about that.",
        "I'm here to help you with that."
    ]
    
    # Add contextual information for common queries
    if any(word in original_message.lower() for word in ['flight', 'book', 'booking']):
        if 'book' in original_message.lower():
            response += " Would you like me to help you with anything else regarding your booking?"
    
    elif any(word in original_message.lower() for word in ['baggage', 'luggage', 'bag']):
        response += " Is there anything specific about baggage policies you'd like to know more about?"
    
    elif any(word in original_message.lower() for word in ['check in', 'checkin']):
        response += " Do you need help with any other check-in related questions?"
    
    # Make response more conversational for voice
    if not response.startswith(('Hello', 'Hi', 'Good', 'Welcome', 'I\'d', 'Let me', 'Here\'s')):
        response = f"Let me help you with that. {response}"
    
    return response

@app.route('/chat/voice', methods=['POST'])
def chat_voice():
    """Dedicated endpoint for voice interactions with enhanced processing"""
    try:
        data = request.json
        if not data:
            return jsonify({"error": "No data received"}), 400

        message = data.get('message', '')
        confidence = data.get('confidence', 1.0)  # Speech recognition confidence
        
        if not message:
            return jsonify({"error": "No voice message provided"}), 400

        # Log voice message with confidence
        app.logger.info(f"Voice message: {message} (Confidence: {confidence})")
        
        # Enhanced processing for voice input
        processed_message = preprocess_voice_message(message)
        
        # Send to DialogFlow
        dialogflow_response = dialogflow_api.run_sample([processed_message], session_id)
        
        if not dialogflow_response or not dialogflow_response[0]:
            return jsonify({"error": "No response from voice assistant"}), 500

        # Format specifically for voice output
        voice_response = format_voice_response(dialogflow_response[0])
        enhanced_voice_response = enhance_response_for_voice(voice_response, processed_message, True)
        
        return jsonify({
            "response": enhanced_voice_response,
            "original_message": message,
            "processed_message": processed_message,
            "confidence": confidence,
            "voice_optimized": True
        })

    except Exception as e:
        app.logger.error(f"Error in voice chat endpoint: {str(e)}")
        return jsonify({
            "error": "I'm sorry, I didn't catch that. Could you please repeat your question?"
        }), 500

# Route to handle file uploads
@app.route('/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    
    file = request.files['file']
    
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    
    if file and allowed_file(file.filename):
        # Create unique filename to prevent collisions
        filename = str(uuid.uuid4()) + '_' + file.filename
        file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(file_path)
        
        return jsonify({
            'success': True,
            'filename': filename,
            'url': url_for('static', filename=f'uploads/{filename}')
        })
    
    return jsonify({'error': 'File type not allowed'}), 400

# Health check endpoint
@app.route('/health')
def health_check():
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.now().isoformat(),
        'voice_enabled': True,
        'dialogflow_configured': True
    })

# Voice capabilities endpoint
@app.route('/voice/capabilities')
def voice_capabilities():
    return jsonify({
        'speech_recognition': True,
        'speech_synthesis': True,
        'supported_languages': ['en-US', 'en-GB'],
        'voice_commands': [
            'book a flight',
            'check flight status',
            'baggage information',
            'check-in help',
            'travel requirements'
        ]
    })

if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=int(os.environ.get("PORT", 8080)))