const DEV = false

/* initialize Global state */
let json = './wordvecs10000.json'
// Create a new word2vec method

const wordVectors = ml5.word2vec(json, modelLoaded);
let tokens, tokenPitches, tokenRhythms, tokenHarmonies;

// For now include all
const NONPOS =
	['cc', 'cd', /*'dt',*/ 'ex', 'fw', /*'in'*/, 'jj', 'jjr', 'jjs', 'ls', 'md', 'nn', 'nns', 'nnp', 'nnps', 'pdt', 'pos', 'prp', 'prp$', 'rb', 'rbr', 'rbs', 'rp', 'sym', 'to', 'uh', 'vb', 'vbd', 'vbg', 'vbn', 'vbp', 'vbz', 'wdt', 'wp', 'wp$', 'wrb'];
const NOUNS =
	['nn', 'nns', 'nnp', 'nnps', 'prp'];
const VERBS =
	['vb', 'vbd', 'vbg', 'vbn', 'vbp', 'vbz']

let synth = new Tone.Synth({
	envelope: {
		attack: 0.25,
		decay: 0.1,
		sustain: 0.3,
		release: 1
	},
	"volume": -6,
	"oscillator": {
		"partials": [1, 2, 5],
	},
}).toMaster();
let polysynth = new Tone.PolySynth(8, Tone.Synth, {
	"volume": -8,
	"oscillator": {
		type: 'sine',
	},
	"portamento": 0.005
}).toMaster();
let BASE = 40;
let part;


// Utility
function isAlphaNumeric(s) {
	return s.match(/^[a-z0-9]+$/i) !== null;
}

// When the model is loaded
function modelLoaded() {
	console.log("Model Loaded!");
}

// In order from most consonant to least consonant

const PITCHES_BASE = [
	7, // P
	4, // M3
	5, // P4
	2, // M2
	9, // M6
	11, // M7
	3, // m3
	8, // m6
	10, // m7
	1, // m2
	6, // T (A4/D5)
]

async function calculate(sentence) {
	// First, find the centroid of all non-preposition words in the sentence
	let sentencefeatures = RiString(sentence).features();
	// Easier to work with is an array of objects for each word
	tokens = sentencefeatures.tokens.split(" ");
	let pos = sentencefeatures.pos.split(" ");
	let stresses = sentencefeatures.stresses.split(new RegExp(" |/"))
	// Lame zip
	let featuremap = [];
	for (let i = 0; i < tokens.length; i++) {
		featuremap[i] = {
			token: tokens[i],
			pos: pos[i],
			vector: wordVectors.model[tokens[i].toLowerCase()],
			similarity: null,

		}
	}
	//console.log(featuremap);
	// Get non-null vectors into a stack

	let features =
		featuremap
			.filter(f => NONPOS.includes(f.pos))
			.filter(f => f.vector != null)

	let vectors = features.map(f => f.vector);
	let stack = ml5.tf.stack(vectors);
	// The centroid will form the base "key" for the melody, and all other words
	let centroid = ml5.tf.mean(stack, axis = 0);

	// Find the point that has closest cosine similarity to the centroid...
	// Now, collect the cosine similiarity magnitude of all non-null vectors compared to the
	// centroid
	let centroidSimilarities = vectors.map(f =>
		ml5.tf.abs(ml5.tf.metrics.cosineProximity(f, centroid))
	)
	let indexOfMin = centroidSimilarities.reduce((iMin, val, i, arr) => val > arr[iMin] ? i : iMin, 0);
	let medioid = vectors[indexOfMin];

	let similarities = vectors.map(v => {
		return ml5.tf.abs(ml5.tf.metrics.cosineProximity(v, medioid))
	});

	let similarityData = similarities.map(s => s.data());
	let similarityValues = await Promise.all(similarityData);
	features.forEach((f, idx) => {
		f.similarity = similarityValues[idx];
	})
	// console.log('featuremap', featuremap);


	// Now we need to translate the collection of similarities into a pitch class
	// First await all the similiarity vectors
	//let similarityData = await Promise.all(similarities.map(f => f.data() ));
	//  l//et similarityValues = similarityData.map(f => constrain(f[0], 0, 1) );
	// for each word in similarity bucket 1, grab a "close" tone
	// for each word in similarity bucket 2, grab a "medium" tone
	// for each word in similarity bucket 3, grab a "far" tone
	let pitches = [];
	let closeTones = [7, 4, 2, 9].reverse();
	let medTones = [5, 11].reverse();
	let farTones = [10, 8, 1, 3, 6].reverse();
	let usedTokens = new Set();
	features.forEach(f => {
		if (usedTokens.has(f.token)) {
			return;
		}
		usedTokens.add(f.token);
		if (f.similarity > 0.2) {
			pitches.push(closeTones.pop());
		} else if (f.similarity > 0.1) {
			pitches.push(medTones.pop());
		} else {
			pitches.push(farTones.pop());
		}
	});
  /*
  let pitches = similarityValues.map(function(f) {
    //console.log(f, Math.sqrt(f));
    let index = Math.floor(map(Math.sqrt(f), 1, 0, 0, PITCHES_BASE.length));
    return PITCHES_BASE[index];
  });
  */
	// Always add the tonic
	pitches = pitches.filter(p => p != null);
	pitches.push(0);
	pitches = Array.from(new Set(pitches));
	pitches = pitches.sort((a, b) => a - b);
	// console.log("pitches", pitches);
	let allPitches = [];
	for (let i = 0; i < 4; i++) {
		let pitch8va = pitches.map(p => p + i * 12);
		allPitches = allPitches.concat(pitch8va);
	}

	// OK , now we have a pitch collection.
	// We should assign a single pitch (or pitch set) to each token
	// Rule 0: first noun gets tonic chord tone
	// Rule 1: nouns are chord tones
	//  => but how do we decide what chord tone to give? (Length of word?)
	//  => longer words could be considered more "colorful"
	//  => how do we decide what chord base to give?
	// Rule 2: verbs are jumps
	//  => a verb changes "key"
	//  => how do we get back to the tonic?
	//  => could only move in circle of 5ths?
	//  => then use some color of the verb to decide whether we move up or down the circle
	//  => Or, markov chain the chord progression
	//  => T -> TS | PD | PPD
	//  => PD ->
	//  => way too complicated. Let's just say each verb adds +7.
	//  => each period resets the key to tonic
	// Rule 3: everything else are decorative tones

	// How do we decide the rhythms?
	// We have access to phonemes and stresses
	// Let's use stresses
	tokenPitches = assignPitches(allPitches, pitches, tokens, featuremap);
	tokenRhythms = assignRhythms(sentence, tokens, tokenPitches);
	tokenHarmonies = assignHarmonies(pitches, featuremap, tokenPitches);
}

function assignPitches(allPitches, pitches, tokens, featuremap) {
	// Pass 1: Fill in skeleton of nouns and verbs
	let baseline = 0; // tonic!
	let tokenPitches = {};
	let currPitch = 0;
	let pitchSkeleton = []
	for (let i = 0; i < tokens.length; i++) {
		// Rule 0: every token gets the same pitch
		let t = tokens[i];
		if (tokenPitches[t] != null) {
			currPitch = tokenPitches[t];
			//  console.log("Assigned Prev Pitch", currPitch, t);
			if (tokenPitches[t] != 'rest') {
				pitchSkeleton.push({ t: t, pitch: currPitch });
			}
			continue;
		}
		let pos = RiTa.getPosTags(t)[0];
		if (NOUNS.includes(pos)) {
			if (pitchSkeleton.length == 0) {
				tokenPitches[t] = 0;
			} else {
				tokenPitches[t] = getPitchForNoun(baseline, t, pitches, featuremap);
			}
			currPitch = tokenPitches[t];
			//  console.log("Assigned Noun Pitch", currPitch, t);
			pitchSkeleton.push({ t: t, pitch: currPitch });
		}
		if (VERBS.includes(pos)) {
			let nextPos = RiTa.getPosTags(tokens[i + 1]);
			if (nextPos == 'vbg' || nextPos == 'vbn') {
				// Blacklist gerund and participle constructions
				continue;
			}
			tokenPitches[t] = getPitchForNoun(baseline + 7, t, pitches, featuremap) % 12;
			currPitch = tokenPitches[t];
			pitchSkeleton.push({ t: t, pitch: currPitch });
			// console.log("Assigned Verb Pitch", currPitch, t);
		}
		if (t == ',' || t == '.' || t == '?' || t == '!' || t == ':' || t == ';') {
			// Pause
			tokenPitches[t] = 'rest';
		}
		if (t == '.') {
			baseline = 0;
		}
	}
	/*
	for(let i = 0; i < tokens.length; i++) {
		console.log(tokens[i], tokenPitches[tokens[i]]);
	}
	console.log("---");
	console.log(pitchSkeleton);
	*/

	// Pass 2: Fill in passing tones
	currPitch = 0;
	let nextSkeletonTargetIndex = 0;
	// No target!
	// Fill one in
	pitchSkeleton.push({
		pitch: getChordTones(7, pitches)[0],
		t: "empty string"
	});
	DEV && console.log("pitch skeleton", pitchSkeleton);
	for (let i = 0; i < tokens.length; i++) {
		// Rule 0: every token gets the same pitch
		let t = tokens[i];
		let nextSkeletonTarget = pitchSkeleton[nextSkeletonTargetIndex];
		if (t == nextSkeletonTarget.t) {
			// Move to next skeleton
			nextSkeletonTargetIndex++;
			currPitch = nextSkeletonTarget.pitch;
			continue;
		}
		if (tokenPitches[t] != null) {
			if (tokenPitches[t] != 'rest') {
				currPitch = tokenPitches[t];
			}
			continue;
		}
		let pitchIndex = allPitches.findIndex(p => p == currPitch);
		if (nextSkeletonTarget.pitch > currPitch) {
			tokenPitches[t] = allPitches[pitchIndex + 1];
		} else {
			tokenPitches[t] = allPitches[pitchIndex - 1];
		}
		if (tokenPitches[t] == undefined) {
			tokenPitches[t] = currPitch;
		}
		currPitch = tokenPitches[t];
	}

	DEV && console.log("token pitches", tokenPitches)

	return tokenPitches;
}

function intersect(a, b) {
	return a.filter(value => b.includes(value))
}

function getNextChord(chord, melodyTones, pitches) {
	// Most important is the first note...
	let normalizedMelody = melodyTones.map(m => m % 12);
	let functionalCandidates = getFunctionalCandidates(chord, pitches);
	// Find the candidate that matches the most of the melody tones
	// Matching the first tone counts as 2
	return functionalCandidates.reduce((curr, prev) => {
		if (intersect(curr.chord, normalizedMelody) > intersect(prev.chord, normalizedMelody)) {
			return curr;
		}
		return prev;
	});
}

function getFunctionalCandidates(chord, pitches) {
	if (chord == "t") {
		// choose tonic substitute or PD
		return [
			{ chordFunction: "t", chord: getChordTones(0, pitches, 0) }, // 0
			{ chordFunction: "t", chord: getChordTones(0, pitches, 1) }, // 0
			{ chordFunction: "t", chord: getChordTones(0, pitches, 2) }, // 0
			{ chordFunction: "ts", chord: getChordTones(8.6, pitches, 0) }, // 6
			{ chordFunction: "ts", chord: getChordTones(3.6, pitches, 0) }, // 3
			{ chordFunction: "pd", chord: getChordTones(2, pitches, 0) }, // 2
			{ chordFunction: "pd", chord: getChordTones(2, pitches, 1) }, // 2
			{ chordFunction: "pd", chord: getChordTones(2, pitches, 2) }, // 2
			{ chordFunction: "pd", chord: getChordTones(5, pitches, 0) }, // 4
			{ chordFunction: "pd", chord: getChordTones(5, pitches, 1) }, // 4
			{ chordFunction: "pd", chord: getChordTones(5, pitches, 2) }, // 4
			{ chordFunction: "d", chord: getChordTones(7, pitches) }, // 2
			{ chordFunction: "d", chord: getChordTones(10.6, pitches) }, // 4
		];
	} else if (chord == "ts") {
		return [
			{ chordFunction: "pd", chord: getChordTones(2, pitches) }, // 2
			{ chordFunction: "pd", chord: getChordTones(5, pitches) }, // 4
		];
	} else if (chord == "pd") {
		return [
			{ chordFunction: "d", chord: getChordTones(7, pitches) }, // 2
			{ chordFunction: "d", chord: getChordTones(10.6, pitches) }, // 4
		];
	} else if (chord == "d") {
		return [
			{ chordFunction: "t", chord: getChordTones(0, pitches) }, // 0
			{ chordFunction: "ts", chord: getChordTones(3.5, pitches) }, // 3
			{ chordFunction: "ts", chord: getChordTones(8.5, pitches) }, // 6
		]
	}
}

function assignHarmonies(pitches, featuremap, tokenPitches) {
	// basic autoharmony using chord changes on nouns
	let chord = "d";
	let chords = {};
	for (let i = 0; i < featuremap.length; i++) {
		let token = featuremap[i];
		if (NOUNS.includes(token.pos)) {
			let melodyTones = [];
			for (let j = i; j < featuremap.length; j++) {
				let token = featuremap[j];
				if (NOUNS.includes(token.pos)) {
					break;
				} else {
					melodyTones.push(tokePitches[toiken.token]);
				}
			}
			// Now do something with the melody tones
			let nextChord = getNextChord(chord, melodyTones, pitches);
			chord = nextChord.chordFunction;
			chords[i] = nextChord;
		} else {
			continue;
		}
	}
	DEV && console.log("chords", chords);
	return chords;
}

function assignRhythms(sentence, tokens) {
	// short words get short rhythm
	// default to quarter notes probably
	let breaks = sentence.split("\n")
	let breakindex = 0;
	let runningTime = new Tone.Time(0);

	let tokenRhythms = tokens.map(t => {
		let pad = false;
		if (breaks[breakindex].startsWith(t)) {
			breaks[breakindex] = breaks[breakindex].slice(t.length);
			// Allow default 1 space
			if (breaks[breakindex].startsWith(" ")) {
				breaks[breakindex] = breaks[breakindex].slice(1);
			}
			if (breaks[breakindex].length == 0) {
				breakindex++;
				pad = true;
			}
		}
		let syllableCount = RiTa.getSyllables(t).split("/").length;
		let stresses = RiTa.getStresses(t).split("/");
		let pos = RiTa.getPosTags(t)[0];
		let rhythm = [];
		if (pos == 'dt' || (pos == 'cc')) {
			rhythm = ["16n"];
		} else if (NOUNS.includes(pos)) {
			rhythm = ["4n"];
		} else if (syllableCount == 4 && stresses[0] == "1") {
			rhythm = ["16n", "16n", "16n", "16n"];
		} else if (syllableCount == 3 && stresses[0] == "1") {
			rhythm = ["8t", "8t", "8t"];
		} else if (syllableCount == 2 && stresses[0] == "1") {
			rhythm = ["8n", "8n"];
		} else if (syllableCount == 2 && stresses[1] == "1") {
			rhythm = ["16n", "8n."];
		} else if (t == '.') {
			rhythm = ["4n"];
		} else {
			let ti = 0
			for (let i = 0; i < syllableCount; i++) {
				ti += new Tone.Time("8n");
			}
			rhythm = [ti];
		}
		runningTime += rhythm.map(t => new Tone.Time(t)).reduce((curr, prev) => curr + prev);
		if (pad) {
			let delta = Tone.Time(runningTime + new Tone.Time("8n")).quantize("4n") - runningTime;
			rhythm[rhythm.length - 1] = new Tone.Time(rhythm[rhythm.length - 1]) + delta;
			runningTime = 0;
		}
		return rhythm;
	});
	DEV && console.log("token rhytmhms", tokenRhythms);
	return tokenRhythms;
}

function createEvents(tokens, tokenPitches, tokenRhythms, tokenHarmonies) {
	let events = [];
	let time = 0;
	for (let i = 0; i < tokens.length; i++) {
		let tp = tokenPitches[tokens[i]];
		let tr = tokenRhythms[i];
		let freq;
		if (tp == 'rest') {
			freq = 'rest';
		} else {
			freq = new Tone.Frequency(tp + BASE + 12, "midi");
		}
		if (tokenHarmonies[i] != null) {
			let l = new Tone.Time(tr[0])
			events.push({
				time: time,
				note: freq,
				harmony: tokenHarmonies[i].chord,
				length: l * 0.9,
			});
		}
		tr.forEach(r => {
			events.push({
				time: time,
				text: tokens[i],
				note: freq,
				length: new Tone.Time(r) * 0.75,
			});
			time += new Tone.Time(r);

		});
	}

	return [events, time]
}

function play(tokens, tokenPitches, tokenRhythms, tokenHarmonies) {

	let [events, time] = createEvents(tokens, tokenPitches, tokenRhythms, tokenHarmonies)

	if (part != null) {
		// cleanup
		part.stop();
		part.dispose();
	}
	DEV && console.log('tokens', tokens);
	DEV && console.log('events', events);
	console.log('events', events);
	part = new Tone.Part(
		function (time, val) {
			if (val.note == 'rest') {
				// do nothing
			} else if (val.harmony != null) {
				polysynth.triggerAttackRelease(val.harmony.map(h => Tone.Frequency(h + BASE, "midi")), val.length, time);
			} else {
				synth.triggerAttackRelease(val.note, val.length, time);
				textStr = val.text;
				console.log(`current: ${textStr}`)
			}

		},
		events
	);
	part.loopEnd = time;
	//part.loop = true;
	part.start();
	Tone.Transport.start();
}

// Save State Pne: use sqrt of similarity, verb same as noun
function getPitchForNoun(baseline, noun, pitches, featuremap) {
	let similarity = featuremap.filter(fm => fm.token == noun)[0].similarity
	if (similarity != null) {
		similarity = similarity[0];
	} else {
		similarity = 0;
	}
	let tones = getChordTones(baseline, pitches, 0);
	let length = Math.floor(map(constrain(Math.sqrt(similarity), 0, 1), 1, 0, 0, tones.length - 1));
	// number of pitches = number of syllables??
	// would we ever want duplicates?
	// maybe but what rule would there be?
	return tones[Math.floor(length)];
}

function getChordTones(start, pitches, color = 2) {
	// get the closest values in pitches to:
	// U, mM3, P5, mM7, mM2
	// 0,3.5,7,10.5, 1.5

	// First, make pitches 2 octaves large to allow for overflow
	let pitch8va = pitches.map(p => p + 12);
	let pitch16va = pitches.map(p => p + 24);
	pitches = pitches.concat(pitch8va).concat(pitch16va);
	let chordTones = [0, 3.6, 7];
	let colors = [13.6, 10.6];
	chordTones = chordTones.concat(colors.slice(2 - color)).map(ct => ct + start);

	//let indexOfMin = centroidSimilarities.reduce((iMin, val, i, arr) => val < arr[iMin] ? i : iMin, 0);
	return chordTones.map(ct =>
		pitches.reduce((prev, curr) => Math.abs(curr - ct) < Math.abs(prev - ct) ? curr : prev)
	);
}

async function greet(value) {
	Tone.context.resume();
	Tone.Transport.bpm = 100;
	await calculate(value)
	play(tokens, tokenPitches, tokenRhythms, tokenHarmonies);
}
