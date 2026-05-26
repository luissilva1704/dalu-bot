import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function analyzeNailDesignBase64(imageBase64) {

    const SYSTEM_PROMPT = `
Eres una experta analista de diseños de uñas para cotizaciones profesionales.

Tu tarea es analizar imágenes de uñas con precisión y consistencia.

Reglas globales:
- No inventes detalles visuales.
- Si no estás segura de algo, devuelve 0.
- Prefiere falsos negativos antes que falsos positivos.
- Analiza uña por uña.
- Solo analiza la mano más visible.
- Cuenta uñas individuales, no elementos decorativos, es decir, si por ejemplo una uña tiene 3 estrellas pintadas no cuentes las 3 estrellas no sume 3 al conteno de hand_paint, solo suma 1.
- Una uña puede pertenecer a varias categorías al mismo tiempo.
- Devuelve exclusivamente JSON válido.
- No incluyas explicaciones fuera del JSON.
- Si la imagen es borrosa, ambigua, cortada, oscura o inconsistente, marca handoff=true.
`.trim();

    const USER_PROMPT = `
Analiza el diseño de uñas en la imagen proporcionada.

Debes identificar:

1) effects
Cuenta uñas con:
- efecto espejo/cromo
- glitter
- cat eye
- aurora
- aura
- holographic
- magnetic gel
- perlado brillante

NO contar:
- french
- babyboomer
- color sólido normal

2) hand_paint
Cuenta uñas con:
- dibujos hechos a mano
- líneas artísticas
- caricaturas
- flores pintadas
- arte detallado hecho con pincel

NO contar:
- stickers
- charms
- french
- patrones impresos

3) babyboomer
Cuenta uñas con:
- degradado natural tipo nude-blanco
- efecto ombré suave típico babyboomer

NO contar:
- ombré de colores fuertes
- glitter fade

4) french
Cuenta uñas con:
- punta francesa claramente definida

SÍ contar:
- french clásico
- french moderno
- french doble
- french de color

NO contar:
- líneas decorativas pequeñas
- contornos parciales

5) rhinestones
Cuenta uñas con:
- cristales
- piedras
- gemas
- pedrería visible

NO contar:
- glitter
- charms metálicos sin piedras

6) encapsulated
Cuenta uñas donde se vean elementos encapsulados dentro del acrílico o gel:
- flores encapsuladas
- glitter encapsulado
- foil encapsulado
- figuras dentro de la estructura

NO contar:
- decoración superficial

7) decoration:
Cuenta SOLO decoración física NO relacionada con cristales o pedrería.

Incluye:
- cadenas
- figuras 3D
- stickers
- relieves físicos
- adornos pegados claramente distintos de piedras

NO cuentes:
- cristales
- rhinestones
- gemas
- pedrería
- glitter
- detalles pintados
- french
- babyboomer

IMPORTANTE:
Si una uña únicamente contiene piedras o cristales, entonces:
- rhinestones_count > 0
- decoration_count = 0
- Si el detalle parece hecho con pincel o pintura, pertenece a hand_paint_count, NO a decoration_count.

7) Nivel de complejidad
simple:
- color sólido
- pocos detalles
- mínimo arte

medio:
- múltiples técnicas
- french
- algunos efectos
- decoración moderada

complejo:
- mano alzada elaborada
- muchas técnicas combinadas
- encapsulados
- mucha pedrería
- diseños altamente detallados

-----------------------------------
REGLAS IMPORTANTES
-----------------------------------

- Cuenta uñas individuales, NO elementos.
- Una uña puede pertenecer a varias categorías.
- Si no puedes ver claramente una uña, no la cuentes.
- Si faltan 1 o 2 uñas pero el patrón visual es MUY consistente, puedes inferir máximo +1 uña similar.
- Nunca asumas automáticamente que las 5 uñas tienen el mismo diseño.
- Si la imagen es borrosa, cortada, oscura o ambigua:
  handoff = true
- Si las dos manos muestran diseños distintos:
  handoff = true
- Si no estás seguro de una categoría:
  devuelve 0 para esa categoría.
- Solo analiza la mano más visible de la imagen.
- Máximo 5 uñas analizadas.
- Presta mucha atención a los reflejos de la luz y no las confundas con lineas blancas pintadas a mano. Si no estas seguro de que sean reflejos o lineas blancas tomalo como reflejo y no incluyas eso en el conteo de hand_paint

REGLA DE PRIORIDAD ENTRE CATEGORIAS:

1. Si el adorno está pintado con esmalte, gel, pintura o líneas finas, cuenta como hand_paint_count.
2. Solo cuenta como decoration_count si es un objeto físico pegado sobre la uña.
3. decoration_count NO debe incluir dibujos, líneas, estrellas pintadas, puntos pintados, marcos dorados pintados, french, efectos, babyboomer ni cristales.
4. Si dudas entre hand_paint_count y decoration_count, usa hand_paint_count y deja decoration_count en 0.
5. Pon mucha atencion entre el baby boomer y el efecto Aura, ya que son muy similares pero en complejidad hay mucha diferencia. Si no estas seguro tomalo como efecto Aura.


REGLA DE EFECTOS
1. Considera que una uña puede tener mas de 1 efecto. Por ejemplo una uña puede tener un efecto espejo acompañado de un efecto como aura o relieve. En este caso debes contar por efecto y no por uña.
6. Si el efecto Baby boomer no es muy marcado, no lo cuentes como baby boomer y tomalo como color liso sin baby boomer

IMPORTANTISIMO
- Asegurate de mandar en la respuesta el conteo correcto de lo que encuentras en tu analisis por ejemplo si
encontraste que 5 uñas tienen efecto glitter y 2 uñas tienen efecto aura entonces effects_count = 7.
- Si una uña tiene glitter y french, entonces french_count = 1 y effects_count = 1.
- Si una uña tiene glitter y aura, entonces effects_count = 2.
- El analisis es por uña, y cada uña suma al conteo en cada categoria.

-----------------------------------
FORMATO DE RESPUESTA
-----------------------------------

Devuelve SOLO este JSON:

{
  "complexity": "simple|medio|complejo",
  "effects_count": number,
  "hand_paint_count": number,
  "babyboomer_count": number,
  "french_count": number,
  "rhinestones_count": number,
  "encapsulated_count": number,
  "decoration_count": number,
  "confidence": "high|medium|low",
  "handoff": boolean
  "Analysis":"Explicacion de tu analisis para debuggear y mejorar el prompt"
}`.trim();


    const response = await client.chat.completions.create({
        model: "gpt-4.1-mini",
        temperature: 0.1,
        response_format: { type: "json_object" },
        messages: [
            {
                role: "system",
                content: SYSTEM_PROMPT
            },
            {
                role: "user",
                content: [
                    {
                        type: "text", text: USER_PROMPT
                    },
                    { type: "image_url", image_url: { url: `data:image/jpeg;base64,${imageBase64}` } }
                ]
            }
        ]
    });
    return JSON.parse(response.choices[0].message.content);
}
