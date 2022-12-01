/** @type {import('tailwindcss').Config} */

export default {
	content: [
		'./index.html',
		'./src/components/*.{devto,js,ts,jsx,tsx}',
		'./src/pages/*.{devto,js,ts,jsx,tsx}',
		'./src/layouts/*.{devto,js,ts,jsx,tsx}'
	],
	theme: {
		extend: {
			colors: {
				gray: {
					'50': '#fafafa',
					'100': '#f4f4f5',
					'200': '#e4e4e7',
					'300': '#d4d4d8',
					'400': '#a1a1aa',
					'500': '#71717a',
					'600': '#52525b',
					'700': '#3f3f46',
					'800': '#27272a',
					'900': '#18181b'
				}
			}
		},
	},
	plugins: [],
};
