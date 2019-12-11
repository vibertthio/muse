

console.log("made by Vibert (vibertthio.com)");


// handle start

let transport = Tone.Transport;
const playBtn = document.getElementById("play-btn");
const sendBtn = document.getElementById('send')
const textArea = document.getElementById('text-area')

textArea.value = `She had blue skin.
And so did he.
He kept it hid
And so did she.
They searched for blue
Their whole life through,
Then passed right by
And never knew.`

StartAudioContext(Tone.context, "#play-btn").then(() => {
	console.log("audio context started");
});

playBtn.addEventListener('click', () => {
	transport.start()
	playing = true
	const infoDiv = document.getElementById('info')

	infoDiv.style.opacity = 0
	setTimeout(() => {
		infoDiv.style.display = 'none'
		textArea.style.zIndex = 0
		sendBtn.style.zIndex = 1
	}, 300)
})


// p5

let playing = false
let position
let windowSize
let textContent = parseText(textArea.value)

function setup() {
	windowSize = { width: window.innerWidth * 0.5, height: window.innerHeight }
	let canvas = createCanvas(windowSize.width, windowSize.height)

	canvas.parent("p5-canvas")
	textFont('IBM Plex Mono')
	textAlign(LEFT, TOP);
	textSize(25)

	background(185, 0, 255, 100)

	// let synth = new Tone.Synth().toMaster()
	transport.scheduleRepeat((time) => {
		// synth.triggerAttackRelease('C2', '16n')
		alpha = 1
	}, '2n')
}

let lineHeight = 32
let fontSize = 15

function draw() {
	position = transport.position.substring(0, transport.position.indexOf('.'))
	alpha *= 0.9


	// lineHeight = map(mouseY, 0, height, 25, 35)
	// console.log(`line height: ${lineHeight}`)

	if (playing) {
		push()
		drawBackground()
		fill(255)
		translate(40, 40)
		for (let i = 0; i < textContent.length; i++) {
			push()
			for (let j = 0; j < textContent[i].length; j++) {
				text(textContent[i][j], 0, 0)
				translate((textContent[i][j].length + 1) * fontSize, 0)
			}
			pop()
			translate(0, lineHeight)
		}
		pop()
		drawTiming()
	}
}

function drawBackground() {
	background(255)
	fill(185, 0, 255)
	rect(-1, -1, width + 2, height + 2)
}

function drawTiming() {
	push()
	translate(width - 150, height * 0.95)
	fill(255)
	text(position, 45, -5)
	noStroke()
	fill(255, alpha * 255)
	ellipse(0, 0, 40, 40)
	pop()
}

function windowResized() {
	resizeCanvas(windowWidth * 0.5, windowHeight)
	background(185, 0, 255, 100)
}


// Text Area

textArea.addEventListener('input', e => {
	textContent = parseText(textArea.value)
})

sendBtn.addEventListener('click', () => {
	greet(textArea.value)
})

function parseText(text) {
	const matrix = text.split('\n').map(line => line.split(' ').filter(str => str !== ''))
	return matrix
}

