

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
And never knew.
You cannot understand me.`


let playing = false
let playingTranslation = false
let finishPlayingTranslation = false
let position
let windowSize
let currentLineIndex = 0
let currentWordIndex = 0
let textContent = parseText(textArea.value)
let textObjects = []
let lineHeight = 32
let fontSize = 15

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


function draw() {
	position = transport.position.substring(0, transport.position.indexOf('.'))
	alpha *= 0.9

	// lineHeight = map(mouseY, 0, height, 25, 35)
	// console.log(`line height: ${lineHeight}`)

	if (playing) {
		push()
		drawBackground()
		if (!playingTranslation) {
			translate(40, 40)
			for (let i = 0; i < textContent.length; i++) {
				push()

				if (i === currentLineIndex) {
					fill(255, 100)
					noStroke();
					ellipse(0, 0, 25, 25)
				}

				for (let j = 0; j < textContent[i].length; j++) {
					fill(255)
					text(textContent[i][j], 0, 0)
					if (i === currentLineIndex && j === currentWordIndex) {
						fill(255, 100)
						noStroke();
						ellipse(0, 0, 25, 25)
					}
					translate((textContent[i][j].length + 1) * fontSize, 0)
				}
				pop()
				translate(0, lineHeight)
			}
		} else {
			if (playingTranslation) {
				push()
				// translate(40, 40)
				let prevX
				let prevY
				for (let i = 0; i < textObjects.length; i++) {
					for (let j = 0; j < textObjects[i].length; j++) {
						const t = textObjects[i][j]
						t.draw()
						if (prevX && prevY) {
							stroke(255, 150)
							strokeWeight(5)
							line(prevX, prevY, t.x, t.y)
						}
						prevX = t.x
						prevY = t.y
					}
				}
				pop()
			}
		}
		pop()


		// drawTiming()
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
	if (finishPlayingTranslation) {
		playingTranslation = false
		finishPlayingTranslation = false
	}
	textContent = parseText(textArea.value)
})

sendBtn.addEventListener('click', () => {
	greet(textArea.value)
})

// music
async function greet(value) {
	Tone.context.resume();
	Tone.Transport.bpm = 100;

	let x = 0
	let y = 0
	textObjects = textContent.map(line => {
		const ret = line.map(word => {
			const textObject = new Text(word, x + 40, y + 40)
			x += (word.length + 1) * fontSize
			return textObject
		})
		x = 0
		y += lineHeight
		return ret
	})

	playingTranslation = true
	await calculate(value)
	play(tokens, tokenPitches, tokenRhythms, tokenHarmonies);
}

function play(tokens, tokenPitches, tokenRhythms, tokenHarmonies) {

	let [events, endTime] = createEvents(tokens, tokenPitches, tokenRhythms, tokenHarmonies)
	events.push({ time: endTime + 1, msg: 'end' })
	let startTime

	if (part != null) {
		// cleanup
		part.stop();
		part.dispose();
	}
	DEV && console.log('tokens', tokens)
	DEV && console.log('events', events)
	resetIndexes(textContent)
	part = new Tone.Part((time, val) => {
		if (val.msg === 'end') {
			DEV && console.log('end of music')
			finishPlayingTranslation = true
			return
		}
		if (startTime === undefined) {
			startTime = time
		}
		if (val.note == 'rest') {
			// do nothing
		} else if (val.harmony != null) {
			polysynth.triggerAttackRelease(val.harmony.map(h => Tone.Frequency(h + BASE, "midi")), val.length, time);
			textObjects[currentLineIndex][currentWordIndex].harmony = val.harmony

		} else {
			synth.triggerAttackRelease(val.note, val.length, time);
			textStr = val.text;

			// while (textStr.includes(filterText(textContent[currentLineIndex][currentWordIndex]))) {
			while (!textContent[currentLineIndex][currentWordIndex].includes(textStr)) {
				currentWordIndex += 1
				if (currentWordIndex >= textContent[currentLineIndex].length) {
					currentLineIndex += 1
					currentWordIndex = 0
				}
				if (currentLineIndex >= textContent.length) {
					currentLineIndex = 0
				}
				while (textContent[currentLineIndex] === undefined || textContent[currentLineIndex].length === 0) {
					currentLineIndex += 1
				}
			}
			// textObjects[currentLineIndex][currentWordIndex].randomizePosition()
			const x = width * map(time, startTime, startTime + endTime, 0.1, 0.9)
			const y = height * map(val.note._val, 52, 64, 0.9, 0.1)
			const l = val.length
			textObjects[currentLineIndex][currentWordIndex].move(x, y, l)
			DEV && console.log(`${textStr} [${currentLineIndex}] [${currentWordIndex}]`)
			DEV && console.log(`t: ${time} note: ${val.note._val}`)
		}
	}, events);
	part.loopEnd = endTime + 0.5;
	// part.loop = true;
	part.start();
	Tone.Transport.start();
}


// parse texts
function parseText(text) {
	const matrix = text.split('\n').map(line => line.split(' ').filter(str => str !== ''))
	resetIndexes(matrix)
	return matrix
}

function resetIndexes(textContent) {
	let count = 0
	while (textContent[count] && textContent[count].length === 0) {
		count++
	}
	currentLineIndex = count
	currentWordIndex = 0
}

function filterText(s) {
	return s.replace(/[^\w'"]/g, '')
}


class Text {
	constructor(str, x, y) {
		this.str = str
		this.x = x
		this.y = y
		this.l = 0
		this.final = { x, y }
		this.harmony
		this.color = 'rgba(255, 255, 255, 1)'
	}

	draw() {
		this.update()
		push()

		translate(this.x, this.y)
		if (this.harmony) {
			fill(67, 174, 166, 200)
			noStroke()
			ellipse(0, 0, 50, 50)
			for (let i = 0; i < this.harmony.length; i++) {
				const h = map(this.harmony[i], 0, 28, 0, this.y)
				ellipse(0, -h, 50 - i * 5, 50 - i * 5)
			}
		}

		push()
		rotate(-0.2)
		fill('#e5ff00')
		noStroke()
		rect(0, 0, this.l * 300, 10)

		translate(this.l * 300, 0)

		rotate(0.2)
		if (this.harmony) {
			fill('rgba(255, 154, 0, 0.9)')
		} else {
			fill('rgba(67, 174, 112, 0.9)')
		}
		noStroke()
		rect(0, 0, this.str.length * fontSize, lineHeight * 0.8)

		fill(this.color)
		noStroke()
		text(this.str, 0, 0)
		pop()

		pop()
	}

	update() {
		this.x += (this.final.x - this.x) * 0.1
		this.y += (this.final.y - this.y) * 0.1
		if (this.final.l) {
			this.l += (this.final.l - this.l) * 0.1
		}
	}

	randomizePosition() {
		this.final.x = random(0, width - 200)
		this.final.y = random(0, height - 200)
	}

	move(x, y, l) {
		const range = 30
		this.final.x = x + random(-range, range)
		this.final.y = y + random(-range, range)
		this.final.l = l
	}


}
