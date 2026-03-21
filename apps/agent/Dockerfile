FROM python:3.12-slim

WORKDIR /app

RUN pip install uv

COPY pyproject.toml .
RUN uv pip install --system -e .

COPY src/ src/

EXPOSE 8000
CMD ["uvicorn", "nekoni_agent.main:app", "--host", "0.0.0.0", "--port", "8000"]
