import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic();

export async function POST(request: NextRequest) {
  try {
    const { frames, club, shotNumber, previousTips, strategyRequest } = await request.json();

    // === STRATEGY MODE ===
    if (strategyRequest) {
      const { distanceToPin, par, hole, courseName, recommendedClub, mapImage } = strategyRequest;

      try {
        const content: Anthropic.Messages.ContentBlockParam[] = [];

        if (mapImage && typeof mapImage === 'string' && mapImage.startsWith('data:image')) {
          // Send satellite image for visual obstacle analysis
          content.push({
            type: 'image',
            source: {
              type: 'base64',
              media_type: 'image/png',
              data: mapImage.replace(/^data:image\/\w+;base64,/, ''),
            },
          });
          content.push({
            type: 'text',
            text: `Eres un caddie de golf experto. MIRA esta imagen satelite del hoyo donde esta el jugador.

DATOS:
- Hoyo ${hole}, Par ${par}, Campo "${courseName}"
- Distancia a la bandera: ${distanceToPin} metros
- Palo recomendado: ${recommendedClub}
- El marcador azul (T) es el jugador, el marcador rojo (${hole}) es la bandera
- La linea verde conecta al jugador con la bandera

ANALIZA LO QUE VES EN LA IMAGEN SATELITE:
- Bunkers: manchas claras/beige/blancas cerca del green o fairway
- Agua/lagos: zonas oscuras azuladas o negras con bordes definidos
- Arboles: masas de verde oscuro a los lados del fairway
- Forma del green: si es grande, pequeño, protegido
- Doglegs o curvas del hoyo
- Cualquier otro obstaculo visible

DAME UNA ESTRATEGIA BASADA EN LO QUE VES:
1. Confirma o cambia el palo segun los obstaculos REALES que ves
2. Tipo de golpe: draw, fade, recto, alto, bajo segun la situacion
3. DONDE APUNTAR: se MUY especifico ("apunta al lado izquierdo del fairway porque a la derecha hay un bunker grande que se ve claramente")
4. QUE EVITAR: nombra los peligros REALES que ves en la imagen con su posicion
5. Un tip de confianza

Habla en espanol, se directo y motivador. 4-5 frases. Texto plano, NO JSON.`,
          });
        } else {
          // Text-only strategy (no image available)
          content.push({
            type: 'text',
            text: `Eres un caddie de golf experto y motivador. El jugador esta en el hoyo ${hole} (par ${par}) del campo "${courseName}".
La bandera esta a ${distanceToPin} metros. El palo recomendado es ${recommendedClub}.

Dame una estrategia practica en 3-4 frases. Incluye que palo usar, tipo de golpe, donde apuntar, que peligros evitar, y un tip de confianza. Habla en espanol. Texto plano, NO JSON.`,
          });
        }

        const strategyMsg = await anthropic.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 500,
          messages: [{ role: 'user', content }],
        });
        const textBlock = strategyMsg.content.find((b) => b.type === 'text');
        return NextResponse.json({
          strategy: textBlock && textBlock.type === 'text' ? textBlock.text : 'No se pudo generar estrategia.',
        });
      } catch (strategyError) {
        console.error('Strategy API error:', strategyError);
        return NextResponse.json(
          { error: 'Error al generar estrategia', details: String(strategyError) },
          { status: 500 }
        );
      }
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
