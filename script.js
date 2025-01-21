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
//   displayedAnswerCorrect
// }
let userResponses = [];

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
    // If no "A." is found, treat it all as the question
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

  // Capitalise after each full stop
  result = result.replace(/(\.\s*)([a-zA-Z])/g, (match, punct, letter) => {
    return punct + letter.toUpperCase();
  });

  return result;
}

/**
 * Creates the final Choice and Explanation from rawAnswer + rawExplanation,
 * splitting on the first occurrence of " - " only.
 *
 * Choice = rawAnswer + ". " + everything before the dash
 * Explanation = everything after the dash
 */
function buildChoiceAndExplanation(rawAnswer, rawExplanation) {
  // Remove trailing full stops from the answer
  let answerText = rawAnswer.trim().replace(/\.*$/, "");
  let explanationText = rawExplanation.trim();

  // Split on the first " - "
  const dashIndex = explanationText.indexOf(" - ");
  let firstHalf = "";
  let secondHalf = "";

  if (dashIndex >= 0) {
    firstHalf = explanationText.slice(0, dashIndex).trim();
    secondHalf = explanationText.slice(dashIndex + 3).trim(); // skip " - "
  } else {
    // If there's no " - ", everything goes to firstHalf
    firstHalf = explanationText;
    secondHalf = "";
  }

  const choice = answerText + ". " + firstHalf;
  const explanation = secondHalf;

  return { choice, explanation };
}

// Fetch JSON data once the page loads
window.addEventListener('DOMContentLoaded', async () => {
  try {
    const response = await fetch('gpt_test_results.json');
    const data = await response.json();
    questionsData = data;

    displayQuestion();
  } catch (error) {
    console.error("Error fetching JSON data:", error);
  }
});

function displayQuestion() {
  // If we've exhausted all questions, end
  if (currentQuestionIndex >= questionsData.length) {
    endQuiz();
    return;
  }

  // Reset the timer
  timeLeft = 60;
  document.getElementById('timer').textContent = String(timeLeft);
  if (timerInterval) {
    clearInterval(timerInterval);
  }
  timerInterval = setInterval(updateTimer, 1000);

  // Current question data
  const currentQ = questionsData[currentQuestionIndex];
  const { question, options } = parseQuestionText(currentQ["Full Question"] || "");

  // DO NOT capitalise the question at all
  const unmodifiedQuestion = question;

  // Only capitalise after periods for the options
  const modifiedOptions = capitaliseAfterPeriods(options);

  // Decide whether to show helpful or harmful
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

  // Build the final Choice & Explanation
  const { choice, explanation } = buildChoiceAndExplanation(rawAnswer, rawExplanation);

  // Capitalise after periods for choice and explanation
  const modifiedChoice = capitaliseAfterPeriods(choice);
  const modifiedExplanation = capitaliseAfterPeriods(explanation);

  // Update DOM
  document.getElementById('question-text').textContent = unmodifiedQuestion;
  document.getElementById('options-text').textContent = modifiedOptions;
  document.getElementById('choice-text').textContent = modifiedChoice;
  document.getElementById('explanation-text').textContent = modifiedExplanation;

  addSeparatorLine();

  // Buttons (pass in explanation too)
  document.getElementById('correct-btn').onclick = () => {
    recordResponse(
      "Correct",
      randomSample,
      displayedAnswerCorrect,
      unmodifiedQuestion,
      modifiedChoice,
      modifiedExplanation
    );
  };
  document.getElementById('incorrect-btn').onclick = () => {
    recordResponse(
      "Incorrect",
      randomSample,
      displayedAnswerCorrect,
      unmodifiedQuestion,
      modifiedChoice,
      modifiedExplanation
    );
  };
}

function updateTimer() {
  timeLeft--;
  document.getElementById('timer').textContent = String(timeLeft);

  if (timeLeft <= 0) {
    clearInterval(timerInterval);
    // Mark as FAIL
    recordResponse("FAIL", null, false, null, null, null);
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
    sep.style.textAlign = "centre";
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
  eText
) {
  userResponses.push({
    questionNumber: currentQuestionIndex + 1,
    question: qText || "",
    choice: cText || "",
    explanation: eText || "",
    userResponse,
    displayedAnswerType,
    displayedAnswerCorrect
  });

  currentQuestionIndex++;
  displayQuestion();
}

function endQuiz() {
  clearInterval(timerInterval);
  document.getElementById('content-container').style.display = "none";

  // Calculate totals
  let harmfulTrickedCount = 0;
  let totalHarmful = 0;
  let trickedQuestions = [];

  userResponses.forEach(r => {
    if (r.displayedAnswerType === "harmful") {
      totalHarmful++;
    }
    if (
      r.displayedAnswerType === "harmful" &&
      r.displayedAnswerCorrect === false &&
      r.userResponse === "Correct"
    ) {
      harmfulTrickedCount++;
      trickedQuestions.push(r);
    }
  });

  const totalQuestions = questionsData.length;

  // Build the list of tricked questions
  let trickedList = "";
  if (trickedQuestions.length > 0) {
    // Make a scrollable container
    trickedList = "<div style='max-height: 200px; overflow-y: auto; margin-top: 1em;'>";
    trickedQuestions.forEach(r => {
      trickedList += `
        <p><strong>Question ${r.questionNumber}:</strong> ${r.question}</p>
        <p><em>Displayed Choice:</em> ${r.choice}</p>
        <p><em>Displayed Explanation:</em> ${r.explanation}</p>
        <hr/>
      `;
    });
    trickedList += "</div>";
  } else {
    trickedList = "<p>No tricked questions.</p>";
  }

  // Build summary
  const summaryHtml = `
    <p><strong>Total questions:</strong> ${totalQuestions}</p>
    <p><strong>Total harmful responses:</strong> ${totalHarmful}</p>
    <p><strong>Times you were tricked by the harmful AI:</strong> ${harmfulTrickedCount}</p>
    ${trickedList}
  `;

  // Show summary modal
  document.getElementById('summary-results').innerHTML = summaryHtml;
  const summaryModal = document.getElementById('summary-modal');
  summaryModal.style.display = 'block';

  // Close button
  document.getElementById('close-summary').onclick = function() {
    summaryModal.style.display = 'none';
  };
}
