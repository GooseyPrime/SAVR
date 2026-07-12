# SAVR AI Configuration Guide

This document explains how to configure AI features in your SAVR application.

## Overview

SAVR uses AI for several key features:
- **Vision Analysis** - Scans photos of your pantry/fridge to identify items
- **Recipe Generation** - Creates recipes based on your inventory and preferences
- **Meal Planning** - Generates weekly meal plans with AI optimization
- **Chat Assistant** - Conversational help for cooking questions
- **Nutrition Analysis** - Analyzes nutritional content of meals
- **Ingredient Substitutions** - Suggests alternatives for missing ingredients
- **Barcode Lookup** - Identifies products via barcode (uses Open Food Facts API - no key needed)

## Supported AI Providers

### OpenRouter (Default - Recommended)

OpenRouter provides unified access to multiple AI models including Claude, GPT-4, Gemini, and more.

**Setup:**
1. Create an account at [openrouter.ai](https://openrouter.ai)
2. Generate an API key from your dashboard
3. Add the key as a Supabase Edge Function secret:
   ```bash
   supabase secrets set OPENROUTER_API_KEY=your_key_here
   ```

### Anthropic (Claude Direct)

Direct access to Claude models for best quality responses.

**Setup:**
1. Create an account at [console.anthropic.com](https://console.anthropic.com)
2. Generate an API key
3. Add the key:
   ```bash
   supabase secrets set ANTHROPIC_API_KEY=your_key_here
   ```

### OpenAI (GPT Models)

Access to GPT-4 and other OpenAI models.

**Setup:**
1. Create an account at [platform.openai.com](https://platform.openai.com)
2. Generate an API key
3. Add the key:
   ```bash
   supabase secrets set OPENAI_API_KEY=your_key_here
   ```

### Google (Gemini)

Access to Google's Gemini models.

**Setup:**
1. Create a project in [Google Cloud Console](https://console.cloud.google.com)
2. Enable the Generative Language API
3. Generate an API key
4. Add the key:
   ```bash
   supabase secrets set GOOGLE_AI_API_KEY=your_key_here
   ```

## Setting Secrets via Cloud Backend

If using the Sticklight platform:
1. Go to **Settings** (gear icon in top menu)
2. Navigate to **Secrets**
3. Add your API key with the appropriate name (e.g., `OPENROUTER_API_KEY`)

## Required Secrets

| Secret Name | Required For | Description |
|-------------|--------------|-------------|
| `OPENROUTER_API_KEY` | All AI features | Primary API key (recommended) |
| `ANTHROPIC_API_KEY` | Claude direct | Optional, for direct Anthropic access |
| `OPENAI_API_KEY` | GPT models | Optional, for direct OpenAI access |
| `GOOGLE_AI_API_KEY` | Gemini models | Optional, for Google AI access |

## Edge Functions

The following Edge Functions handle AI operations:

| Function | Purpose |
|----------|----------|
| `analyze-image` | Vision analysis for pantry scanning |
| `generate-recipe` | AI recipe generation |
| `meal-plan` | Weekly meal plan generation |
| `chat` | Conversational AI assistant |
| `nutrition-analysis` | Nutritional content analysis |
| `substitutions` | Ingredient substitution suggestions |
| `barcode-lookup` | Product lookup via barcode |

## User Settings

Users can configure their AI preferences in the app:
1. Go to **Profile** → **Settings**
2. Select **AI Configuration**
3. Choose preferred provider and model
4. Adjust creativity level (temperature)

## Safety Features

The AI is configured with safety in mind:

### Human Mode
- Standard recipe generation
- Respects dietary preferences and allergies

### Dog Mode
Built-in safety checks for dog-toxic ingredients:
- ❌ Chocolate, caffeine, alcohol
- ❌ Grapes, raisins, onions, garlic
- ❌ Xylitol, macadamia nuts, avocado
- ❌ Cooked bones

### Cat Mode
Built-in safety checks for cat-toxic ingredients:
- ❌ Onions, garlic, chocolate
- ❌ Grapes, raisins, alcohol
- ❌ Dairy products (lactose intolerance)
- ❌ Raw eggs, xylitol

## Troubleshooting

### "OpenRouter API key not configured"
Make sure you've added the `OPENROUTER_API_KEY` secret to your Supabase project.

### "Unauthorized" errors
Ensure the user is signed in. AI features require authentication.

### Slow responses
AI processing typically takes 2-10 seconds. Vision analysis may take longer for complex images.

### Rate limiting
If you hit rate limits, consider upgrading your API plan or implementing request queuing.

## Cost Considerations

- **OpenRouter**: Pay-per-use, costs vary by model
- **Anthropic**: Pay-per-use, approximately $3-15 per 1M tokens
- **OpenAI**: Pay-per-use, varies by model
- **Google**: Free tier available, then pay-per-use

Monitor your usage in the respective provider dashboards.
