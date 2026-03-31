# String Search Explorer

A web application for exploring, visualizing, and comparing string search algorithms step by step.

## Algorithms Implemented

| Algorithm     | Best     | Average  | Worst   |
|---------------|----------|----------|---------|
| Naive         | O(n)     | O(n*m)   | O(n*m)  |
| Rabin-Karp    | O(n+m)   | O(n+m)   | O(n*m)  |
| KMP           | O(n)     | O(n+m)   | O(n+m)  |
| Boyer-Moore   | O(n/m)   | O(n/m)   | O(n*m)  |

## Architecture

Uses the **Strategy** design pattern:

```
SearchStrategy (abstract)
    NaiveSearch
    RabinKarpSearch
    KMPSearch
    BoyerMooreSearch
```

## Project Structure

```
string-search-explorer/
    app.py                      # Flask server + API routes
    requirements.txt
    algorithms/
        __init__.py
        base.py                 # SearchStrategy ABC + data classes
        naive.py
        rabin_karp.py
        kmp.py
        boyer_moore.py
    static/
        css/main.css
        js/app.js
    templates/
        index.html
    uploads/                    # Uploaded .txt files (auto-created)
```

## Setup

```bash
pip install -r requirements.txt
python app.py
```

Open http://localhost:5000 in your browser.

## Features

- Upload one or multiple .txt files
- Manual text entry / editing
- Select algorithm from dropdown
- Execute search (normal mode)
- Step-by-step execution with play/pause/slider
- Text and pattern character highlighting
- Auxiliary structure display (LPS table, bad character table, hash values)
- Metrics: occurrences, comparisons, execution time
- Compare all 4 algorithms side by side with bar charts
- Complexity reference table
