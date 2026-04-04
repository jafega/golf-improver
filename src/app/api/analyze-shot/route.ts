import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic();

export async function POST(request: NextRequest) {
  try {
    const { frames, club, shotNumber, previousTips, strategyRequest } = await request.json();

    // === STRATEGY MODE ===
    if (strategyRequest) {
      const { distanceToPin, par, hole, courseName, recommendedClub, mapImage } = strategyRequest;

      const content: Anthropic.Messages.ContentBlockParam[] = [];

      // If we have a satellite map screenshot, send it for visual analysis
      if (mapImage) {
        content.push({
          type: 'image',
          source: {
            type: 'base64',
            media_type: 'image/jpeg',
            data: mapImage.replace(/^data:image\/\w+;base64,/, ''),
          },
        });
        content.push({
          type: 'text',
          text: `Eres un caddie de golf experto. Mira esta vista satelite del hoyo actual.

El jugador (punto azul) esta en el hoyo ${hole} (par ${par}) del campo "${courseName}".
La bandera (🚩) esta a ${distanceToPin} metros. El palo recomendado es ${recommendedClub}.

ANALIZA LA IMAGEN SATELITE para identificar:
- Bunkers (manchas blancas/beige cerca del green o en el fairway)
- Lagos o agua (zonas oscuras/azules)
- Arboles (masas verdes oscuras a los lados)
- Forma del green (redondo, alargado, inclinado)
- Doglegs o curvas del fairway
- OB o fuera de limites

Basandote en lo que VES en la imagen, dame una estrategia especifica:
1. PALO: Confirma o cambia el palo recomendado segun los obstaculos
2. TIPO DE GOLPE: draw, fade, recto, alto, bajo, punch...
3. DONDE APUNTAR: se especifico (ej: "lado izquierdo del fairway para evitar el bunker de la derecha")
4. QUE EVITAR: nombra los peligros REALES que ves en la imagen
5. TIP: un consejo de confianza

Habla en espanol, se directo y motivador. 3-5 frases maximo. Texto plano, NO JSON.`,
        });
      } else {
        content.push({
          type: 'text',
          text: `Eres un caddie de golf experto. El jugador esta en el hoyo ${hole} (par ${par}) del campo "${courseName}".
La bandera esta a ${distanceToPin} metros. El palo recomendado es ${recommendedClub}.

Dame una estrategia concisa para este golpe. Incluye tipo de golpe, donde apuntar, obstaculos tipicos a evitar a esta distancia, y un tip de confianza. Habla en espanol, 3-4 frases. Texto plano, NO JSON.`,
        });
      }

      const strategyMsg = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 600,
        messages: [{ role: 'user', content }],
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
