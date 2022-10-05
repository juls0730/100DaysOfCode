import { RouterLink } from '../components/routerLink';

export default () => {
    return `
    <div class="grid place-items-center p-3 content-center min-h-screen">
        <div class="p-6 border-neutral-800 rounded-lg container__content  border">
        <h1 class="text-2xl font-semibold">100DaysOfCode Progress</h1>
        <br/>
        <div class="grid grid-cols-1">
            ${RouterLink('/experiences/day1-2', 'Day 1 & 2')}
            ${RouterLink('/experiences/day3', 'Day 3')}
            Day 4 I Changed how the temple is rendered so I can have text before the variable
            ${RouterLink('/experiences/day5', 'Day 5')}
            ${RouterLink('/experiences/day6', 'Day 6')}
            ${RouterLink('/experiences/day7', 'Day 7')}
            ${RouterLink('/experiences/day8-10', 'Day 8 & 10')}
            ${RouterLink('/experiences/day9', 'Day 9')}
            ${RouterLink('/experiences/day11', 'Day 11')}
            ${RouterLink('/experiences/day12', 'Day 12')}
        </div>
    </div>
    `;
}

export const layout = 'default'