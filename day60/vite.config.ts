/** @type {import('vite').UserConfig} */
export default {
	build: {
		target: 'es2022',
	},
    
	server: {
		port: 8080,
		host: '0.0.0.0',
		watch: {
			include: ['./**/pages/**.devto', './public/**', './**/components/**.devto']
		}
	},
};
