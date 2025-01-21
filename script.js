let questionsData = [];
let currentQuestionIndex = 0;
let timerInterval = null;
let timeLeft = 60;

// We'll keep track of each user response with:
// {
//   questionNumber,
//   question,
//   choice,
//   explanation,
//   userResponse,
//   displayedAnswerType,
//   displayedAnswerCorrect,
//   correctAnswer (from JSON, if any)
// }
let userResponses = [];

/**
 * Dynamically create and show a start modal pop-up.
 */
function showStartModal() {
  const modal = document.createElement('div');
  modal.id = 'start-modal';
  modal.className = 'modal';
  modal.style.display = 'block'; // Make it visible immediately

  modal.innerHTML = `
    <div class="modal-content">
      <span class="close" id="close-start">&times;</span>
      <p>This is an experiment. You are about to see a drill.</p>
    </div>
  `;

  document.body.appendChild(modal);

  const closeBtn = modal.querySelector('#close-start');
  closeBtn.addEventListener('click', () => {
    modal.style.display = 'none';
  });
}

/**
 * Splits "Full Question" into:
 *  - question: everything before "A."
 *  - options: everything from "A." onward
 */
function parseQuestionText(fullQuestion) {
  const indexA = fullQuestion.indexOf("A.");
  if (indexA > -1) {
    return {
      question: fullQuestion.slice(0, indexA).trim(),
      options: fullQuestion.slice(indexA).trim()
    };
  } else {
    return { question: fullQuestion, options: "" };
  }
}

/**
 * Capitalise every letter that follows a full stop,
 * but do NOT capitalise the first character of the entire string.
 */
function capitaliseAfterPeriods(str) {
  if (!str) return str.trim();

  let result = str.trim();
  result = result.replace(/(\.\s*)([a-zA-Z])/g, (match, punct, letter) => {
    return punct + letter.toUpperCase();
  });

  return result;
}

/**
 * Splits the options text into separate chunks for A, B, C, D.
 */
function splitOptionsIntoABCD(optionsStr) {
  const result = { A: "", B: "", C: "", D: "" };
  const pattern = /A\.\s*(.*?)(?=B\.|$)|B\.\s*(.*?)(?=C\.|$)|C\.\s*(.*?)(?=D\.|$)|D\.\s*(.*)/gs;
  let match;

  while ((match = pattern.exec(optionsStr)) !== null) {
    if (match[1] !== undefined) {
      result.A = match[1].trim();
    } else if (match[2] !== undefined) {
      result.B = match[2].trim();
    } else if (match[3] !== undefined) {
      result.C = match[3].trim();
    } else if (match[4] !== undefined) {
      result.D = match[4].trim();
    }
  }
  return result;
}

/**
 * Creates the final Choice and Explanation from rawAnswer + rawExplanation,
 * splitting on the first occurrence of " - " only.
 */
function buildChoiceAndExplanation(rawAnswer, rawExplanation) {
  let answerText = rawAnswer.trim().replace(/\.*$/, "");
  let explanationText = rawExplanation.trim();

  const dashIndex = explanationText.indexOf(" - ");
  let firstHalf = "";
  let secondHalf = "";

  if (dashIndex >= 0) {
    firstHalf = explanationText.slice(0, dashIndex).trim();
    secondHalf = explanationText.slice(dashIndex + 3).trim();
  } else {
    firstHalf = explanationText;
    secondHalf = "";
  }

  const choice = answerText + ". " + firstHalf;
  const explanation = secondHalf;

  return { choice, explanation };
}

// Once the page loads, fetch JSON data and show the first question
window.addEventListener('DOMContentLoaded', async () => {
  try {
    showStartModal();

    const response = await fetch('gpt_test_results.json');
    const data = await response.json();
    questionsData = data;

    displayQuestion();
  } catch (error) {
    console.error("Error fetching JSON data:", error);
  }
});

function displayQuestion() {
  if (currentQuestionIndex >= questionsData.length) {
    endQuiz();
    return;
  }

  // Reset and start timer
  timeLeft = 60;
  document.getElementById('timer').textContent = String(timeLeft);
  if (timerInterval) {
    clearInterval(timerInterval);
  }
  timerInterval = setInterval(updateTimer, 1000);

  const currentQ = questionsData[currentQuestionIndex];
  const { question, options } = parseQuestionText(currentQ["Full Question"] || "");

  // Do NOT capitalise the question at all
  const unmodifiedQuestion = question;

  // Capitalise options
  const modifiedOptions = capitaliseAfterPeriods(options);

  // Split options
  const splittedOptions = splitOptionsIntoABCD(modifiedOptions);

  document.getElementById('choice-text-A').textContent = splittedOptions.A ? "A. " + splittedOptions.A : "";
  document.getElementById('choice-text-B').textContent = splittedOptions.B ? "B. " + splittedOptions.B : "";
  document.getElementById('choice-text-C').textContent = splittedOptions.C ? "C. " + splittedOptions.C : "";
  document.getElementById('choice-text-D').textContent = splittedOptions.D ? "D. " + splittedOptions.D : "";

  // Randomly decide helpful or harmful
  const randomSample = Math.random() < 0.5 ? "helpful" : "harmful";
  const helpfulCorrect = (currentQ["Helpful Correct?"] === "YES");
  const harmfulCorrect = (currentQ["Harmful Correct?"] === "YES");

  let rawAnswer = "";
  let rawExplanation = "";
  let displayedAnswerCorrect = false;

  if (randomSample === "helpful") {
    rawAnswer = currentQ["Helpful Answer"] || "";
    rawExplanation = currentQ["Helpful Explanation"] || "";
    displayedAnswerCorrect = helpfulCorrect;
  } else {
    rawAnswer = currentQ["Harmful Answer"] || "";
    rawExplanation = currentQ["Harmful Explanation"] || "";
    displayedAnswerCorrect = harmfulCorrect;
  }

  // Build final choice & explanation
  const { choice, explanation } = buildChoiceAndExplanation(rawAnswer, rawExplanation);
  const modifiedChoice = capitaliseAfterPeriods(choice);
  const modifiedExplanation = capitaliseAfterPeriods(explanation);

  // Get correct answer from JSON file (assuming it's in a "Correct Answer" field)
  const correctAnswer = currentQ["Correct Answer"] || "";

  // Update DOM
  document.getElementById('question-text').textContent = unmodifiedQuestion;
  document.getElementById('choice-text').textContent = modifiedChoice;
  document.getElementById('explanation-text').textContent = modifiedExplanation;

  addSeparatorLine();

  document.getElementById('correct-btn').onclick = () => {
    recordResponse(
      "Correct",
      randomSample,
      displayedAnswerCorrect,
      unmodifiedQuestion,
      modifiedChoice,
      modifiedExplanation,
      correctAnswer
    );
  };
  document.getElementById('incorrect-btn').onclick = () => {
    recordResponse(
      "Incorrect",
      randomSample,
      displayedAnswerCorrect,
      unmodifiedQuestion,
      modifiedChoice,
      modifiedExplanation,
      correctAnswer
    );
  };
}

function updateTimer() {
  timeLeft--;
  document.getElementById('timer').textContent = String(timeLeft);

  if (timeLeft <= 0) {
    clearInterval(timerInterval);
    // Mark as FAIL (timed out)
    recordResponse("FAIL", null, false, null, null, null, null);
  }
}

/**
 * Inserts a line of underscores above the timer if not already present.
 */
function addSeparatorLine() {
  const parent = document.getElementById('content-container');
  const timerBox = document.getElementById('timer-box');
  if (!document.getElementById('separator-line')) {
    const sep = document.createElement('p');
    sep.id = "separator-line";
    sep.style.textAlign = "center"; 
    sep.textContent = "___________";
    parent.insertBefore(sep, timerBox);
  }
}

function recordResponse(
  userResponse,
  displayedAnswerType,
  displayedAnswerCorrect,
  qText,
  cText,
  eText,
  correctAnswer
) {
  userResponses.push({
    questionNumber: currentQuestionIndex + 1,
    question: qText || "",
    choice: cText || "",
    explanation: eText || "",
    userResponse,
    displayedAnswerType,
    displayedAnswerCorrect,
    correctAnswer: correctAnswer || ""
  });

  currentQuestionIndex++;
  displayQuestion();
}

function endQuiz() {
  clearInterval(timerInterval);
  document.getElementById('content-container').style.display = "none";

  // Calculate totals
  const totalQuestions = questionsData.length;
  const totalFails = userResponses.filter(r => r.userResponse === "FAIL").length;
  const questionsAttempted = totalQuestions - totalFails;

  let harmfulTrickedCount = 0;
  let totalHarmful = 0;

  // We'll also gather all harmful responses for final display
  const harmfulResponses = [];

  userResponses.forEach(r => {
    if (r.displayedAnswerType === "harmful") {
      totalHarmful++;

      // Add to our harmful list
      harmfulResponses.push(r);

      // If user pressed "Correct" but the displayed answer was actually incorrect
      // user was tricked
      if (r.userResponse === "Correct" && r.displayedAnswerCorrect === false) {
        harmfulTrickedCount++;
      }
    }
  });

  // Build the summary
  let summaryHtml = `
    <h2>Summary</h2>
    <p><strong>Total questions:</strong> ${totalQuestions}</p>
    <p><strong>Questions attempts:</strong> ${questionsAttempted}</p>
    <p><strong>Total harmful responses:</strong> ${totalHarmful}</p>
    <p><strong>Times you were tricked by the harmful AI:</strong> ${harmfulTrickedCount}</p>
    <h3>Harmful AI responses:</h3>
  `;

  if (harmfulResponses.length > 0) {
    harmfulResponses.forEach(r => {
      // Determine background colour
      // Red if tricked: Pressed Correct + Actually Incorrect + Harmful
      // Green if not tricked: Pressed Correct + Actually Correct + Harmful
      //                 OR Pressed Incorrect + Actually Incorrect + Harmful
      // If user timed out or something else, we won't colour them here; keep them neutral (or treat as not tricked).
      let bgColour = "#f0f0f0";
      const isCorrectPressed = (r.userResponse === "Correct");
      const isIncorrectPressed = (r.userResponse === "Incorrect");
      const isAnswerCorrect = r.displayedAnswerCorrect;

      if (isCorrectPressed && !isAnswerCorrect) {
        // tricked
        bgColour = "#f8d7da"; // red-ish
      } else if (
        (isCorrectPressed && isAnswerCorrect) ||
        (isIncorrectPressed && !isAnswerCorrect)
      ) {
        // not tricked
        bgColour = "#d4edda"; // green-ish
      }

      summaryHtml += `
        <div style="background-color: ${bgColour}; padding: 10px; margin: 10px 0;">
          <p><strong>Question ${r.questionNumber}:</strong> ${r.question}</p>
          <p><em>Displayed Choice:</em> ${r.choice}</p>
          <p><em>Displayed Explanation:</em> ${r.explanation}</p>
          <p><em>Correct Answer:</em> ${r.correctAnswer}</p>
        </div>
        <hr/>
      `;
    });
  } else {
    summaryHtml += "<p>No harmful AI responses were displayed.</p>";
  }

  document.getElementById('summary-results').innerHTML = summaryHtml;

  const summaryModal = document.getElementById('summary-modal');
  summaryModal.style.display = 'block';

  document.getElementById('close-summary').onclick = function() {
    summaryModal.style.display = 'none';
  };
}
