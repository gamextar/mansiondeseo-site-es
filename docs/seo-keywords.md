# Keywords SEO de intención

El archivo editable es `data/seo/intent-keywords.json`.

La forma recomendada es agrupar por categorías pilar y subcategorías:

```json
{
  "categories": [
    {
      "id": "swingers",
      "label": "Swingers",
      "intent": "swingers",
      "subcategories": [
        {
          "id": "parejas",
          "label": "Parejas swingers",
          "keywords": [
            {
              "term": "parejas swingers buenos aires",
              "location": "Buenos Aires"
            }
          ]
        }
      ]
    }
  ]
}
```

Cada keyword puede ser un string:

```json
"cornudos argentina"
```

O un objeto con más control:

```json
{
  "term": "parejas liberales argentina",
  "intent": "parejas liberales",
  "location": "Argentina",
  "slug": "parejas-liberales-argentina",
  "enabled": true
}
```

Campos útiles:

- `term`: keyword principal. Obligatorio.
- `intent`: grupo semántico. Si falta, se infiere.
- `location`: ubicación usada en cards/textos. Si falta, se infiere.
- `slug`: URL manual. Si falta, se genera desde `term`.
- `title`, `description`, `h1`, `intro`: overrides opcionales para páginas importantes.
- `enabled: false`: desactiva la keyword sin borrarla.

Comandos:

```bash
npm run build
npm run seo:audit
```

Recomendación editorial:

- Empezar con 10-15 categorías pilar.
- Crear primero 50-100 keywords de intención clara.
- Medir impresiones/clicks en Search Console antes de escalar.
- Evitar muchas páginas casi iguales que compitan entre sí.
