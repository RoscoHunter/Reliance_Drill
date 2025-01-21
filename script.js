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
//   correctAnswer,
//   correctAnswerText
// }
let userResponses = [];

/**
 * Dynamically create and show a start modal pop-up.
 * We won't start the quiz until the user clicks the close button.
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

  // When user closes the modal, hide it and start the quiz
  const closeBtn = modal.querySelector('#close-start');
  closeBtn.addEventListener('click', () => {
    modal.style.display = 'none';
    // Only now display the first question (which starts the timer)
    displayQuestion();
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

/**
 * Load data once DOM is ready, but do NOT start the quiz until
 * the user closes the first modal.
 */
window.addEventListener('DOMContentLoaded', async () => {
  try {
    showStartModal();

    const response = await fetch('gpt_test_results.json');
    questionsData = await response.json();
  } catch (error) {
    console.error("Error fetching JSON data:", error);
  }
});

function displayQuestion() {
  if (currentQuestionIndex >= questionsData.length) {
    endQuiz();
    return;
  }

  // Reset and start the timer
  timeLeft = 60;
  document.getElementById('timer').textContent = String(timeLeft);
  if (timerInterval) {
    clearInterval(timerInterval);
  }
  timerInterval = setInterval(updateTimer, 1000);

  const currentQ = questionsData[currentQuestionIndex];
  const { question, options } = parseQuestionText(currentQ["Full Question"] || "");

  // Do NOT capitalise the question
  const unmodifiedQuestion = question;

  // Capitalise after periods for options
  const modifiedOptions = capitaliseAfterPeriods(options);

  // Split options into A, B, C, D
  const splittedOptions = splitOptionsIntoABCD(modifiedOptions);

  // Update multiple choice text
  document.getElementById('choice-text-A').textContent = splittedOptions.A ? "A. " + splittedOptions.A : "";
  document.getElementById('choice-text-B').textContent = splittedOptions.B ? "B. " + splittedOptions.B : "";
  document.getElementById('choice-text-C').textContent = splittedOptions.C ? "C. " + splittedOptions.C : "";
  document.getElementById('choice-text-D').textContent = splittedOptions.D ? "D. " + splittedOptions.D : "";

  // Decide if helpful or harmful
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

  // Build final choice and explanation
  const { choice, explanation } = buildChoiceAndExplanation(rawAnswer, rawExplanation);
  const modifiedChoice = capitaliseAfterPeriods(choice);
  const modifiedExplanation = capitaliseAfterPeriods(explanation);

  // Extract the correct answer from JSON
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
      splittedOptions,
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
      splittedOptions,
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
    recordResponse("FAIL", null, false, null, null, null, null, null);
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

/**
 * Record the user's response and move on to the next question.
 */
function recordResponse(
  userResponse,
  displayedAnswerType,
  displayedAnswerCorrect,
  qText,
  splittedOptions,
  cText,
  eText,
  correctAnswer
) {
  let correctAnswerText = "";
  if (splittedOptions && correctAnswer) {
    // A, B, C, D keys
    correctAnswerText = splittedOptions[correctAnswer] || "";
  }

  userResponses.push({
    questionNumber: currentQuestionIndex + 1,
    question: qText || "",
    choice: cText || "",
    explanation: eText || "",
    userResponse,
    displayedAnswerType,
    displayedAnswerCorrect,
    correctAnswer: correctAnswer || "",
    correctAnswerText: correctAnswerText
  });

  currentQuestionIndex++;
  displayQuestion();
}

/**
 * At the end, we show the summary in a modal.
 */
function endQuiz() {
  clearInterval(timerInterval);
  document.getElementById('content-container').style.display = "none";

  const totalQuestions = questionsData.length;
  const totalFails = userResponses.filter(r => r.userResponse === "FAIL").length;
  const questionsAttempted = totalQuestions - totalFails;

  let harmfulTrickedCount = 0;
  let totalHarmful = 0;
  const harmfulResponses = [];

  userResponses.forEach(r => {
    if (r.displayedAnswerType === "harmful") {
      totalHarmful++;
      harmfulResponses.push(r);
      // If user pressed "Correct" but the displayed answer was actually incorrect => tricked
      if (r.userResponse === "Correct" && r.displayedAnswerCorrect === false) {
        harmfulTrickedCount++;
      }
    }
  });

  let summaryHtml = `
    <p><strong>Total number of questions:</strong> ${totalQuestions}</p>
    <p><strong>Total number of questions attempted:</strong> ${questionsAttempted}</p>
    <p><strong>Total number of reliance drills:</strong> ${totalHarmful}</p>
    <p><strong>Total number of instances of potential over-reliance:</strong> ${harmfulTrickedCount}</p>
    <h2>Results of the reliance drills:</h2>
  `;

  if (harmfulResponses.length > 0) {
    harmfulResponses.forEach(r => {
      // Determine the background colour
      // Red if: Pressed Correct + Actually Incorrect + Harmful
      // Green if: (Pressed Correct + Actually Correct + Harmful)
      //        OR (Pressed Incorrect + Actually Incorrect + Harmful)
      let bgColour = "#f0f0f0";
      const isCorrectPressed = (r.userResponse === "Correct");
      const isIncorrectPressed = (r.userResponse === "Incorrect");
      const isAnswerCorrect = r.displayedAnswerCorrect;

      if (isCorrectPressed && !isAnswerCorrect) {
        bgColour = "#f8d7da"; // red-ish
      } else if (
        (isCorrectPressed && isAnswerCorrect) ||
        (isIncorrectPressed && !isAnswerCorrect)
      ) {
        bgColour = "#d4edda"; // green-ish
      }

      summaryHtml += `
        <div style="background-color: ${bgColour}; padding: 10px; margin: 10px 0;">
          <p><strong>Question ${r.questionNumber}:</strong> ${r.question}</p>
          <p><em>Displayed Choice:</em> ${r.modifiedChoice}</p>
          <p><em>Displayed Explanation:</em> ${r.modifiedExplanation}</p>
          <p><em>Correct Answer:</em> ${r.correctAnswer}. ${r.correctAnswerText}</p>
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
