package com.ankiquiz.service;

/**
 * The card template that makes an exported Quizanki deck answerable as multiple choice inside Anki.
 *
 * <p>This is ours on purpose. Community MCQ templates exist and work, but shipping somebody else's
 * code inside a product means a licence review for roughly a hundred lines of JavaScript; writing it
 * is cheaper than clearing it. It also lets the markup match what the web quiz does.
 *
 * <p><b>It travels inside the {@code .apkg}</b> — a template lives in the note type, so the learner
 * installs no add-on. That is the single most important property of this approach.
 *
 * <h2>Three decisions that keep it working</h2>
 *
 * <p><b>1. The answer side does NOT re-run the shuffle.</b> The obvious {@code afmt} starts with
 * {@code {{FrontSide}}}, but that re-executes this script, which would reshuffle and show a different
 * option order on the back than the learner just answered on. Anki offers no state that survives
 * between the question and answer renders on every platform, so the answer side is plain static HTML
 * built from the {@code Answer} field. Nothing to synchronise, nothing to get out of step.
 *
 * <p><b>2. It does not auto-flip the card.</b> Flipping from JavaScript means platform-specific calls
 * — {@code pycmd('ans')} on desktop, {@code showAnswer()} on AnkiDroid, a tap setting on iOS — and
 * those are exactly what breaks across Anki releases. Clicking an option grades it in place; the
 * learner then reveals and rates the card with Anki's own controls. Ordinary Anki, which is the goal:
 * the scheduler stays Anki's.
 *
 * <p><b>3. ES5 only.</b> No arrow functions, no template literals, no {@code let}/{@code const}, no
 * optional chaining. AnkiDroid renders cards in the Android System WebView, whose version is whatever
 * the device happens to have. Modern syntax would work on most and fail silently — a blank card — on
 * the rest.
 *
 * <p>Choices are split on line breaks and each one is kept as HTML, so inline formatting inside an
 * option survives. Anki's editor stores manual line breaks as {@code <br>} or wraps lines in
 * {@code <div>}s depending on how they were typed, so the splitter normalises all three.
 */
final class AnkiMcqTemplate {

    /** How many options a card offers at most. More baked choices than this is the point. */
    private static final int SLOTS = 4;

    private AnkiMcqTemplate() {
    }

    /**
     * The question side: the prompt, the shuffled options, and the grading.
     *
     * <p>{@code Choices} is rendered into a hidden element rather than read from a field directly —
     * a template has no way to hand a field to JavaScript as data, so the DOM is the channel.
     */
    static String question() {
        return """
                <div class="qz-prompt">{{Question}}</div>

                <div id="qz-choices-src" class="qz-hidden">{{Choices}}</div>
                <div id="qz-options" class="qz-options"></div>
                <div id="qz-hint" class="qz-hint">Pick an answer, then show the card.</div>

                <script>
                (function () {
                  var SLOTS = %d;
                  var LABELS = ["A", "B", "C", "D", "E", "F"];

                  /* Anki stores typed line breaks as <br>, or as one <div> per line, depending on how
                     they were entered. Normalise every form to \\n before splitting. */
                  function linesOf(html) {
                    var text = html
                      .replace(/<br\\s*\\/?>/gi, "\\n")
                      .replace(/<\\/(div|p|li)>/gi, "\\n")
                      .replace(/<(div|p|ul|ol|li)[^>]*>/gi, "");
                    var raw = text.split("\\n");
                    var out = [];
                    for (var i = 0; i < raw.length; i++) {
                      var line = raw[i].replace(/^\\s+|\\s+$/g, "");
                      if (line.length > 0) { out.push(line); }
                    }
                    return out;
                  }

                  /* Fisher-Yates. Unseeded on purpose: a fresh order every review is the feature. */
                  function shuffle(list) {
                    for (var i = list.length - 1; i > 0; i--) {
                      var j = Math.floor(Math.random() * (i + 1));
                      var tmp = list[i]; list[i] = list[j]; list[j] = tmp;
                    }
                    return list;
                  }

                  /* Compare on visible text so <b>cat</b> and cat are not offered as two options. */
                  function plain(html) {
                    var d = document.createElement("div");
                    d.innerHTML = html;
                    return (d.textContent || d.innerText || "").replace(/\\s+/g, " ")
                      .replace(/^\\s+|\\s+$/g, "").toLowerCase();
                  }

                  var src = document.getElementById("qz-choices-src");
                  var host = document.getElementById("qz-options");
                  var hint = document.getElementById("qz-hint");
                  if (!src || !host) { return; }

                  var lines = linesOf(src.innerHTML);
                  if (lines.length === 0) {
                    hint.textContent = "This card has no answer options.";
                    return;
                  }

                  /* By contract the first line is correct. Remember it before anything moves. */
                  var correct = lines[0];
                  var correctKey = plain(correct);

                  var pool = [];
                  var seen = {};
                  seen[correctKey] = true;
                  for (var i = 1; i < lines.length; i++) {
                    var key = plain(lines[i]);
                    if (key.length > 0 && !seen[key]) { seen[key] = true; pool.push(lines[i]); }
                  }

                  /* Correct answer plus a fresh sample of the distractors, then shuffle positions so
                     the answer is not always in the same place. */
                  var options = shuffle(pool).slice(0, Math.max(0, SLOTS - 1));
                  options.push(correct);
                  shuffle(options);

                  var answered = false;
                  for (var k = 0; k < options.length; k++) {
                    (function (optionHtml) {
                      var btn = document.createElement("button");
                      btn.type = "button";
                      btn.className = "qz-option";
                      var label = document.createElement("span");
                      label.className = "qz-label";
                      label.textContent = LABELS[k] || String(k + 1);
                      var body = document.createElement("span");
                      body.className = "qz-body";
                      body.innerHTML = optionHtml;
                      btn.appendChild(label);
                      btn.appendChild(body);

                      btn.onclick = function () {
                        if (answered) { return; }
                        answered = true;
                        var right = plain(optionHtml) === correctKey;
                        btn.className += right ? " qz-correct" : " qz-wrong";
                        /* Always show which one was right, including when they got it right —
                           seeing the correct option confirmed is part of the recall. */
                        var all = host.getElementsByClassName("qz-option");
                        for (var m = 0; m < all.length; m++) {
                          all[m].disabled = true;
                          if (all[m] !== btn && all[m].getAttribute("data-correct") === "1") {
                            all[m].className += " qz-correct";
                          }
                        }
                        hint.textContent = right
                          ? "Correct — show the card and rate it."
                          : "Not quite — show the card to see the answer.";
                        hint.className = "qz-hint " + (right ? "qz-hint-ok" : "qz-hint-bad");
                      };

                      if (plain(optionHtml) === correctKey) { btn.setAttribute("data-correct", "1"); }
                      host.appendChild(btn);
                    })(options[k]);
                  }
                })();
                </script>
                """.formatted(SLOTS);
    }

    /**
     * The answer side. Static by design — see the class comment.
     *
     * <p>Built from {@code Answer} rather than from {@code Choices}, so it stays correct even if the
     * learner edits or reorders the options in Anki's editor. {@code Extra} carries whatever the
     * original card had beyond the two faces, and {@code Source} credits the deck it came from.
     */
    static String answer() {
        return """
                <div class="qz-prompt">{{Question}}</div>

                <hr id=answer>

                <div class="qz-answer">{{Answer}}</div>

                {{#Extra}}<div class="qz-extra">{{Extra}}</div>{{/Extra}}
                {{#Source}}<div class="qz-source">{{Source}}</div>{{/Source}}
                """;
    }

    /**
     * Styling for both of Anki's themes.
     *
     * <p>Anki adds {@code .nightMode} (desktop) and {@code .night_mode} (AnkiDroid) to the card, so
     * both spellings are handled — a palette that only covers one leaves half the users reading dark
     * text on a dark background.
     */
    static String css() {
        return """
                .card {
                  font-family: -apple-system, "Segoe UI", Roboto, arial, sans-serif;
                  font-size: 20px;
                  text-align: center;
                  color: #1f1a17;
                  background-color: #faf7f3;
                }
                .qz-prompt { font-size: 1.2em; font-weight: 600; margin: 0 0 1em; }
                .qz-hidden { display: none; }

                .qz-options {
                  display: block;
                  max-width: 34em;
                  margin: 0 auto;
                  text-align: left;
                }
                .qz-option {
                  display: flex;
                  align-items: center;
                  gap: 0.6em;
                  width: 100%;
                  margin: 0.4em 0;
                  padding: 0.7em 0.9em;
                  font: inherit;
                  font-size: 0.9em;
                  text-align: left;
                  color: inherit;
                  background: #fffdfb;
                  border: 1px solid #d9cfc4;
                  border-radius: 10px;
                  cursor: pointer;
                }
                .qz-option:disabled { cursor: default; }
                .qz-label {
                  flex: 0 0 auto;
                  width: 1.6em;
                  height: 1.6em;
                  line-height: 1.6em;
                  text-align: center;
                  font-weight: 700;
                  font-size: 0.85em;
                  border-radius: 50%;
                  background: #efe6db;
                }
                .qz-body { flex: 1 1 auto; }

                /* Both states get a border AND a tint: colour alone excludes colour-blind learners. */
                .qz-option.qz-correct { border-color: #2f7a4f; background: #eaf5ee; }
                .qz-option.qz-wrong   { border-color: #a8372c; background: #fbecea; }

                .qz-hint { margin-top: 1em; font-size: 0.7em; color: #6b6058; }
                .qz-hint-ok  { color: #2f7a4f; }
                .qz-hint-bad { color: #a8372c; }

                .qz-answer { font-size: 1.1em; font-weight: 600; }
                .qz-extra  { margin-top: 0.8em; font-size: 0.85em; }
                .qz-source { margin-top: 1.2em; font-size: 0.65em; color: #6b6058; }

                .nightMode .card, .night_mode .card { color: #ece6e0; background-color: #23201d; }
                .nightMode .qz-option, .night_mode .qz-option {
                  background: #2c2824; border-color: #453f39;
                }
                .nightMode .qz-label, .night_mode .qz-label { background: #3a342e; }
                .nightMode .qz-option.qz-correct, .night_mode .qz-option.qz-correct {
                  border-color: #5fae7f; background: #23312a;
                }
                .nightMode .qz-option.qz-wrong, .night_mode .qz-option.qz-wrong {
                  border-color: #d2796d; background: #332524;
                }
                .nightMode .qz-hint, .night_mode .qz-hint { color: #a79c92; }
                .nightMode .qz-hint-ok, .night_mode .qz-hint-ok { color: #5fae7f; }
                .nightMode .qz-hint-bad, .night_mode .qz-hint-bad { color: #d2796d; }
                .nightMode .qz-source, .night_mode .qz-source { color: #a79c92; }
                """;
    }
}
