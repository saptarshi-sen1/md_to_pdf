# Sample Document

This is a sample Markdown file used to smoke-test the tool (`npm test`).

## A flowchart

```mermaid
flowchart LR
    A[Start] --> B{Work?}
    B -- Yes --> C[Ship it]
    B -- No --> D[Debug]
    D --> B
```

## A sequence diagram

```mermaid
sequenceDiagram
    participant U as User
    participant A as Agent
    U->>A: ask question
    A->>A: think
    A-->>U: answer
```

## A mindmap

```mermaid
mindmap
  root((Tool))
    Render
      Mermaid
      Charts
    Export
      PDF
      HTML
```

## Code sample

```python
def hello():
    print("world")
```