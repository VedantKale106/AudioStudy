from flask import Flask, render_template, request, jsonify, redirect, url_for
import os
import mammoth
import json
import re

app = Flask(__name__)

# Configuration
MATERIAL_FOLDER = 'static/material'
SONGS_FOLDER = 'static/songs'

# Ensure directories exist
os.makedirs(MATERIAL_FOLDER, exist_ok=True)
os.makedirs(SONGS_FOLDER, exist_ok=True)
os.makedirs('static/js', exist_ok=True)
os.makedirs('static/css', exist_ok=True)

# Function to parse Word files and extract Q&A content
def parse_word_file(file_path):
    try:
        with open(file_path, "rb") as docx_file:
            result = mammoth.extract_raw_text(docx_file)
            text = result.value
            
            # Parse Q&A format
            qa_pairs = []
            lines = text.split('\n')
            current_question = None
            current_answer = []
            
            for i, line in enumerate(lines):
                line = line.strip()
                if not line:
                    continue
                
                # Check if line is a question (simple heuristic: ends with ?)
                # or starts with Q, Question, etc.
                if line.endswith('?') or re.match(r'^Q[:.)]|^Question', line, re.IGNORECASE):
                    # If we have a previous question, save it
                    if current_question is not None:
                        qa_pairs.append({
                            'question': current_question,
                            'answer': ' '.join(current_answer)
                        })
                    
                    current_question = line
                    current_answer = []
                else:
                    # If we have a question, add this line to its answer
                    if current_question is not None:
                        current_answer.append(line)
                    # If no question yet and this isn't empty, it might be a first question without ? mark
                    elif line:
                        current_question = line
            
            # Add the last Q&A pair
            if current_question is not None and (current_answer or not qa_pairs):
                qa_pairs.append({
                    'question': current_question,
                    'answer': ' '.join(current_answer)
                })
                
            return qa_pairs
    except Exception as e:
        print(f"Error parsing {file_path}: {e}")
        return []

# Route for the home page (subject list)
@app.route('/')
def index():
    subjects = []
    
    # Check if files exist in the material folder
    if os.path.exists(MATERIAL_FOLDER):
        for filename in os.listdir(MATERIAL_FOLDER):
            if filename.endswith('.docx'):
                subject_name = os.path.splitext(filename)[0]
                subjects.append({
                    'name': subject_name,
                    'file': filename
                })
    
    # Get list of songs
    songs = []
    if os.path.exists(SONGS_FOLDER):
        for filename in os.listdir(SONGS_FOLDER):
            if filename.endswith(('.mp3', '.wav')):
                songs.append(filename)
    
    return render_template('index.html', subjects=subjects, songs=songs)

# Route to parse content and redirect to player
@app.route('/subject/<subject_name>')
def subject(subject_name):
    file_path = os.path.join(MATERIAL_FOLDER, f"{subject_name}.docx")
    
    if not os.path.exists(file_path):
        return "Subject file not found", 404
    
    # Parse the Word file and extract Q&A content
    qa_content = parse_word_file(file_path)
    
    # Get list of songs for break time
    songs = []
    if os.path.exists(SONGS_FOLDER):
        for filename in os.listdir(SONGS_FOLDER):
            if filename.endswith(('.mp3', '.wav')):
                songs.append(filename)
    
    # Prepare the data to pass to the template
    content_data = {
        'subject': subject_name,
        'qa_pairs': qa_content,
        'songs': songs
    }
    
    # Pass the data to the player template
    return render_template('player.html', content=content_data)

# API endpoint to get content as JSON
@app.route('/api/content/<subject_name>')
def get_content(subject_name):
    file_path = os.path.join(MATERIAL_FOLDER, f"{subject_name}.docx")
    
    if not os.path.exists(file_path):
        return jsonify({"error": "Subject file not found"}), 404
    
    qa_content = parse_word_file(file_path)
    
    return jsonify({
        'subject': subject_name,
        'qa_pairs': qa_content
    })

# API endpoint to get available songs
@app.route('/api/songs')
def get_songs():
    songs = []
    if os.path.exists(SONGS_FOLDER):
        for filename in os.listdir(SONGS_FOLDER):
            if filename.endswith(('.mp3', '.wav')):
                songs.append(filename)
    
    return jsonify(songs)

if __name__ == '__main__':
    app.run(debug=True)