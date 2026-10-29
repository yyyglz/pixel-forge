import {defineConfig} from 'vitest/config';
import path from 'node:path';
export default defineConfig({resolve:{alias:{'@':path.resolve(__dirname),'react':path.resolve(__dirname,'node_modules/react'),'react-dom':path.resolve(__dirname,'node_modules/react-dom')},dedupe:['react','react-dom']},test:{environment:'jsdom',setupFiles:['./vitest.setup.ts'],server:{deps:{inline:['@testing-library/react','@tanstack/react-query']}}}});
