// @ts-nocheck
import { chan, Channel, select } from 'https://creatcodebuild.github.io/csp/dist/csp.js';
import { MergeSort, InsertionSort, infinite } from './sort.js';

function SortVisualizationComponent(id: string, arrays: Channel<number[]>) {

    let ele: HTMLElement | null = document.getElementById(id);
    if(!ele || !ele.shadowRoot) {
        throw new Error('ele has no shadow root');
    }
    let stop = chan<null>();
    let resume = chan<null>();


    // Animation SVG
    let changeSpeed = chan();
    CreateArrayAnimationSVGComponent(ele.shadowRoot, id + 'animation', 0, 0)(arrays, stop, resume, changeSpeed);

    // Stop/Resume Button
    let button = ele.shadowRoot.querySelector('button');
    if(!button) {
        throw new Error();
    }
    let stopped = false;
    button.addEventListener('click', async () => {
        stopped = !stopped;
        if (stopped) {
            button.textContent = 'resume'
            await stop.put(null);
        } else {
            button.textContent = 'stop'
            await resume.put(null);
        }
    });

    // Input
    let input = ele.shadowRoot.querySelector('input')
    input.addEventListener('input', async (ele, event: Event) => {
        console.log(ele.target.value);
        await changeSpeed.put(ele.target.value);
    })
}

function CreateArrayAnimationSVGComponent(
    parent: ShadowRoot,
    id: string,
    x: number, y: number
) {
    let svg = parent.querySelector('svg');
    // let svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.id = id;
    let div = document.createElement('div');
    div.appendChild(svg);
    parent.insertBefore(div, parent.firstChild);
    return async (
        arrays: Channel<number[]>, 
        stop: Channel, 
        resume: Channel,
        changeSpeed: Channel<number>
    ) => {
        let waitToResume = await needToStop(stop, resume);
        let currentSpeed = 100;
        for await (let array of arrays) {
            await waitToResume.pop();
            while (svg.lastChild) {
                svg.removeChild(svg.lastChild);
            }
            for (let [i, number] of Object.entries(array)) {
                let r = rect(x + Number(i) * 4, y, 3, number);
                svg.appendChild(r);
            }
            await sleep(await select(
                [
                    [changeSpeed, newSpeed => {
                        currentSpeed = newSpeed;
                        return currentSpeed;
                    }]
                ],
                () => {
                    return currentSpeed;
                }
            ));
        }
    }

    function rect(x, y, width, height): SVGElementTagNameMap['rect'] {
        // https://developer.mozilla.org/en-US/docs/Web/API/Document/createElementNS
        // https://stackoverflow.com/questions/12786797/draw-rectangles-dynamically-in-svg
        let rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('width', width);
        // @ts-ignore
        rect.setAttribute('height', height);
        // @ts-ignore
        rect.setAttribute('x', x);
        rect.setAttribute('y', y);
        // rect.classList.add(className);
        return rect;
    }
}

function sleep(time) {
    return new Promise((resolve) => {
        setTimeout(resolve, time);
    })
}




async function main() {
    // init an array
    let array = [];
    for (let i = 0; i < 50; i++) {
        array.push(Math.floor(Math.random() * 50));
    }

    // event queue
    let insertQueue = chan<number[]>();
    let mergeQueue = chan<[number[], number]>();
    let stop = chan<null>();
    let resume = chan<null>();
    // controlButton(stop, resume);


    console.log('begin sort', array);
    infinite(InsertionSort, array, insertQueue);
    infinite(MergeSort, array, mergeQueue)
    // let s1 = InsertionSort(array, insertQueue);
    // let s2 = MergeSort(array, mergeQueue);
    // console.log('after sort');


    let mergeQueue2 = (() => {
        let c = chan();
        (async () => {
            let numebrsToRender = [].concat(array);
            await c.put(numebrsToRender)
            while (1) {
                let [numbers, startIndex] = await mergeQueue.pop();
                // console.log(numbers);
                for (let i = 0; i < numbers.length; i++) {
                    numebrsToRender[i + startIndex] = numbers[i];
                }
                await c.put(numebrsToRender)
            }
        })();
        return c;
    })();
    console.log(mergeQueue2);

    
    customElements.define('sort-visualization',
        class extends HTMLElement {
            constructor() {
                super();
                let template = document.getElementById('sort-visualization');
                let templateContent = template.content;
                const shadowRoot = this.attachShadow({ mode: 'open' })
                    .appendChild(templateContent.cloneNode(true));
            }
        }
    );

    SortVisualizationComponent('insertion-sort', insertQueue);
    SortVisualizationComponent('merge-sort', mergeQueue2);
}
main();

async function needToStop(stop: Channel<null>, resume: Channel<null>) {
    let stopResume = chan();
    let stopped = false;
    (async () => {
        while (1) {
            await select(
                [
                    [resume, async () => {
                        stopped = false;
                        await stopResume.put();
                    }],
                    [stop, async () => {
                        stopped = true;
                    }]
                ],
                async () => {
                    if (stopped) {
                        await resume.pop();
                        stopped = false;
                    } else {
                        await stopResume.put();
                    }
                }
            )
        }
    })();
    return stopResume;
}
