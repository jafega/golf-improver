import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic();

export async function POST(request: NextRequest) {
  try {
    const { frames, club, shotNumber, previousTips, strategyRequest } = await request.json();

    // === STRATEGY MODE (no frames needed) ===
    if (strategyRequest) {
      const { distanceToPin, par, hole, courseName, recommendedClub } = strategyRequest;
      const strategyMsg = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 512,
        messages: [
          {
            role: 'user',
            content: `Eres un caddie de golf experto. El jugador esta en el hoyo ${hole} (par ${par}) del campo "${courseName}".
La bandera esta a ${distanceToPin} metros. El palo recomendado es ${recommendedClub}.

Dame una estrategia concisa y practica para este golpe en 2-3 frases. Incluye:
- Que tipo de golpe hacer (punch, draw, fade, alto, bajo, etc.)
- Donde apuntar (centro del green, lado izquierdo, etc.)
- Que evitar (bunkers, agua, etc. tipicos a esta distancia)
- Un tip de confianza mental

Habla en espanol, se directo y motivador. NO uses JSON, responde en texto plano.`,
          },
        ],
      });
      const textBlock = strategyMsg.content.find((b) => b.type === 'text');
      return NextResponse.json({
        strategy: textBlock && textBlock.type === 'text' ? textBlock.text : 'No se pudo generar estrategia.',
      });
    }

    // === SHOT ANALYSIS MODE ===
    if (!frames || frames.length === 0) {
      return NextResponse.json(
        { error: 'No frames provided' },
        { status: 400 }
      );
    }

    const imageContent = frames.map((frame: { dataUrl: string; label: string }) => [
      {
        type: 'text' as const,
        text: `[${frame.label}]`,
      },
      {
        type: 'image' as const,
        source: {
          type: 'base64' as const,
          media_type: 'image/jpeg' as const,
          data: frame.dataUrl.replace(/^data:image\/\w+;base64,/, ''),
        },
      },
    ]).flat();

    const previousContext = previousTips?.length
      ? `\nEn el tiro anterior, los consejos fueron: ${previousTips.join('. ')}. Compara con este tiro.`
      : '';

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Eres un instructor de golf profesional. Analiza estas ${frames.length} imagenes secuenciales de un swing de golf.

Palo usado: ${club}
Numero de tiro en la sesion: ${shotNumber}${previousContext}

Responde SOLO con un JSON valido (sin markdown, sin backticks) con esta estructura exacta:
{
  "overallRating": <numero del 1 al 10>,
  "straightness": <numero del 0 al 100 que indica que tan recto fue el golpe. 100 = perfectamente recto al objetivo, 0 = completamente desviado. Evalua basandote en la trayectoria visible de la bola, el path del palo en el impacto y la posicion del cuerpo>,
  "swingTips": ["<consejo 1>", "<consejo 2>", "<consejo 3>"],
  "keyObservations": ["<observacion 1>", "<observacion 2>"],
  "comparisonToLast": "<comparacion con el tiro anterior o null si es el primer tiro>",
  "distance": {
    "estimated": <distancia estimada en metros basada en lo que ves>,
    "confidence": "<baja|media|alta>"
  }
}

Se conciso y practico. Habla en espanol. Los consejos deben ser accionables y especificos.`,
            },
            ...imageContent,
          ],
        },
      ],
    });

    const textBlock = message.content.find((b) => b.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      throw new Error('No text response from Claude');
    }

    // Parse JSON response
    let analysis;
    try {
      analysis = JSON.parse(textBlock.text);
    } catch {
      // Try to extract JSON from response
      const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Could not parse AI response as JSON');
      }
    }

    return NextResponse.json(analysis);
  } catch (error) {
    console.error('Analysis error:', error);
    return NextResponse.json(
      { error: 'Error al analizar el tiro' },
      { status: 500 }
    );
  }
}
