/** Traduce mensajes de estado de generación/aplicación a español. */
export function toSpanishGenerationStatus(message: string): string {
  if (!message) return message;

  const exact: Record<string, string> = {
    'Initializing AI...': 'Inicializando la IA...',
    'Planning application structure...': 'Planificando la estructura de la app...',
    'Planning your app...': 'Planificando tu app...',
    'Generating React app...': 'Generando la app React...',
    'Scraping website content...': 'Extrayendo el contenido del sitio...',
    'Prompt ready!': '¡Prompt listo!',
    'Website scraped successfully!': '¡Sitio extraído correctamente!',
    'Fetching current files from sandbox...': 'Obteniendo archivos del sandbox...',
    'Generated main App.jsx': 'App.jsx principal generado',
    'Generated App.jsx structure': 'Estructura de App.jsx generada',
    'Code generated successfully!': '¡Código generado correctamente!',
    'Starting code application...': 'Empezando a aplicar el código...',
    'Morph Fast Apply enabled': 'Morph Fast Apply activado',
    'No additional packages to install, skipping...': 'No hay paquetes adicionales que instalar...',
    'Creating a sandbox and generating your app from the prompt...':
      'Creando un sandbox y generando tu app a partir del prompt...',
    'Generating a React app from your prompt...':
      'Generando una app a partir de tu prompt...',
    'AI recreation generated!': '¡Recreación de la IA generada!',
    'Extracting brand styles from the website...':
      'Extrayendo estilos de marca del sitio...',
    'Using cached content from search results...':
      'Usando contenido en caché de los resultados de búsqueda...',
    'Edit applied successfully!': '¡Edición aplicada correctamente!',
    'Command completed successfully': 'Comando completado correctamente',
    'Could not analyze existing files for targeted edits. Proceeding with general edit mode.':
      'No se pudieron analizar los archivos existentes. Continuando en modo de edición general.',
    'No existing files found. Consider generating initial code first.':
      'No hay archivos existentes. Genera el código inicial primero.',
    'Detected incomplete code generation. Attempting to complete...':
      'Se detectó código incompleto. Intentando completar...',
    'Truncation recovery complete': 'Recuperación de truncado completada',
  };

  if (exact[message]) return exact[message];

  let out = message;

  out = out.replace(/^Generating (.+)$/i, 'Generando $1');
  out = out.replace(/^Completed (.+)$/i, 'Completado $1');
  out = out.replace(/^Generated (.+)$/i, 'Generado $1');
  out = out.replace(/^Installing (.+)$/i, 'Instalando $1');
  out = out.replace(/^Completing (.+)\.\.\.$/i, 'Completando $1...');
  out = out.replace(/^Package detected: (.+)$/i, 'Paquete detectado: $1');
  out = out.replace(/^Package detected from imports: (.+)$/i, 'Paquete detectado en imports: $1');
  out = out.replace(/^Identified edit type: (.+)$/i, 'Tipo de edición: $1');
  out = out.replace(
    /^Applied (\d+) files? successfully!$/i,
    (_, n) => `¡${n} archivo${n === '1' ? '' : 's'} aplicado${n === '1' ? '' : 's'} correctamente!`
  );
  out = out.replace(
    /^Generated (\d+) files?!$/i,
    (_, n) => `¡${n} archivo${n === '1' ? '' : 's'} generado${n === '1' ? '' : 's'}!`
  );
  out = out.replace(
    /^Command failed with exit code (.+)$/i,
    'El comando falló con código de salida $1'
  );
  out = out.replace(
    /^Sandbox created! ID: (.+)\. I now have context of your sandbox and can help you build your app\. Just ask me to create components and I'll automatically apply them![\s\S]*/,
    '¡Sandbox creado! ID: $1. Ya tengo el contexto de tu sandbox y puedo ayudarte a construir la app. Pídeme componentes y los aplicaré automáticamente.'
  );

  out = out.replace(
    /^Successfully built your app from the prompt(.*)$/i,
    (_, rest) => `¡App creada a partir del prompt${rest.replace(/ with your requested context: "([^"]+)"/, ' con el contexto: «$1»').replace(/\.\s*You can now ask me to modify it or add more features\./, '')}! Ya puedes pedirme cambios o más funciones.`
  );
  out = out.replace(
    /^Successfully recreated (.+) as a modern React app(.*)$/i,
    '¡$1 recreado como app React moderna$2'
  );

  return out;
}
