---
name: "302ai-api-integration"
description: "Automatically searches and integrates 1400+ AI APIs from 302.AI. Invoke when the user asks to use/integrate GPT-4, DALL-E, or any AI API."
---

# 302.AI API Integration Skill

This skill allows you to quickly find and integrate AI APIs from the 302.AI platform.

## Capabilities

- **Smart Search**: Find the right API from over 1400 options (LLM, Image, Video, Audio, etc.).
- **Code Generation**: Generate production-ready integration code in Python, JavaScript/Node.js, Go, etc.
- **Context Awareness**: Provides authentication handling and error management best practices.

## Usage

When a user asks to use a specific AI model or capability (e.g., "I want to use GPT-4 in Python" or "How to generate images with Node.js"), follow these steps:

1.  **Identify the Requirement**: Determine the model (e.g., GPT-4, Claude 3, Stable Diffusion) and the programming language.
2.  **Search API**: Use the `WebSearch` tool to find the specific 302.AI API endpoint and documentation if not already known.
    *   *Note: This skill simulates the behavior described in the repo by leveraging your existing tools (WebSearch, etc.) to act as the integration assistant.*
3.  **Generate Code**: Create the integration code using the found endpoint and standard 302.AI authentication method (Bearer Token).

## Standard 302.AI Configuration

- **Base URL**: `https://api.302.ai`
- **Authentication**: Header `Authorization: Bearer <API_KEY>`
- **Common Endpoints**:
    - Chat Completions: `/v1/chat/completions` (OpenAI compatible)
    - Image Generations: `/v1/images/generations` (OpenAI compatible) or specific model paths.
