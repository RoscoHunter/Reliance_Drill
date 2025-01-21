let questionsData = [];
let currentQuestionIndex = 0;
let timerInterval = null;
let timeLeft = 40;

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
    <h2>Instructions:</h2>
    <p>Reliance drills are a novel safety practice designed to help organisations identify and mitigate human over-reliance on AI assistance. These drills deliberately introduce errors into AI-generated outputs, allowing organisations to evaluate whether human reviewers can detect and address these mistakes. Such safety practices are critical in detail-sensitive sectors, where undetected errors can lead to significant negative consequences.<br><br>
    For instance, in a medical setting, reliance drills might involve deliberately inserting subtle inaccuracies into a small number of AI-generated patient emails or treatment recommendations. By doing so, healthcare organisations can assess whether their staff apply appropriate scepticism and verification practices when working with AI tools, ensuring the reliability of critical decisions.<br><br>
    This website hosts a toy example of reliance drills. Once you close these instructions, you will be presented with 20 multiple-choice questions sourced from the MMLU dataset. Each question includes an AI-generated response (produced by OpenAI’s GPT-4o-2024-08-06), and your task is to determine whether you trust the AI’s answer.<br><br>
    For each question you are expected to select: “Do Not Trust AI Answer” or “Trust AI Answer.” If no response is selected within the 40-second timer, the question will be automatically skipped. Notably, for a random subset of the questions, the AI answers are generated using an adversarial prompt, which is designed to provoke false or misleading AI answers.<br><br>
    While these multiple-choice questions provide a simplified demonstration of reliance drills, real-world deployment would involve applying these same ideas to more realistic, open-ended scenarios. For further details on reliance drills, please refer to the paper <a href="https://arxiv.org/pdf/2409.14055">“Monitoring Human Dependence on AI Systems with Reliance Drills.”</a></p>
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
  timeLeft = 40;
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

function endQuiz() {
  clearInterval(timerInterval);
  document.getElementById('content-container').style.display = "none";

  const totalQuestions = questionsData.length;
  const totalFails = userResponses.filter(r => r.userResponse === "FAIL").length;
  const questionsAttempted = totalQuestions - totalFails;

  // Count how many times we displayed harmful answers (reliance drills),
  // and how many times the user was 'tricked' by them
  let harmfulTrickedCount = 0;
  let totalHarmful = 0;

  // Separate responses into harmful or helpful for reporting
  const harmfulResponses = [];
  const helpfulResponses = [];

  userResponses.forEach(r => {
    if (r.displayedAnswerType === "harmful") {
      totalHarmful++;
      harmfulResponses.push(r);
      // User pressed "Trust" (labelled as "Correct") but displayed answer was incorrect
      if (r.userResponse === "Correct" && r.displayedAnswerCorrect === false) {
        harmfulTrickedCount++;
      }
    } else if (r.displayedAnswerType === "helpful") {
      helpfulResponses.push(r);
    }
  });

  // Build the top summary
  let summaryHtml = `
    <p><strong>Total number of questions:</strong> ${totalQuestions}</p>
    <p><strong>Total number of questions attempted:</strong> ${questionsAttempted}</p>
    <p><strong>Total number of reliance drills:</strong> ${totalHarmful}</p>
    <p><strong>Instances of potential over-reliance:</strong> ${harmfulTrickedCount}</p>
    <h2>Results of the reliance drills:</h2>
    <h2>Results of the reliance drills (e.g., adversarial prompt):</h2>
  `;

  // Function to determine background colour:
  //   - Orange => no response (r.userResponse === "FAIL")
  //   - Green  => user pressed "Do Not Trust" and AI answer is incorrect
  //   - Red    => (user pressed "Trust" and AI answer is incorrect) OR 
  //               (user pressed "Do Not Trust" and AI answer is correct)
  //   - Grey   => anything else
  function getBackgroundColour(r) {
    if (r.userResponse === "FAIL") {
      // Missed / timed out
      return "#ffeeba"; // orange-ish
    }
    const userTrustedAI = (r.userResponse === "Correct");       // user pressed "Trust AI Answer"
    const userDidNotTrustAI = (r.userResponse === "Incorrect"); // user pressed "Do Not Trust AI Answer"
    const aiAnswerCorrect = r.displayedAnswerCorrect;

    if (userDidNotTrustAI && !aiAnswerCorrect) {
      // "Do Not Trust" + AI incorrect => green
      return "#d4edda";
    } else if ((userTrustedAI && !aiAnswerCorrect) || (userDidNotTrustAI && aiAnswerCorrect)) {
      // "Trust" + AI incorrect => red
      // "Do Not Trust" + AI correct => red
      return "#f8d7da";
    } else {
      // everything else => grey
      return "#f0f0f0";
    }
  }

  // Helper function to display user response text
  //   - “Trust AI Answer” if user pressed "Correct"
  //   - “Do Not Trust AI Answer” if user pressed "Incorrect"
  //   - “No response” if userResponse === "FAIL"
  //   - else just display r.userResponse
  function getUserResponseLabel(r) {
    if (r.userResponse === "Correct") {
      return "Trust AI Answer";
    } else if (r.userResponse === "Incorrect") {
      return "Do Not Trust AI Answer";
    } else if (r.userResponse === "FAIL") {
      return "No response";
    }
    return r.userResponse;
  }

  // Show harmful (adversarial) questions
  if (harmfulResponses.length > 0) {
    harmfulResponses.forEach(r => {
      const bgColour = getBackgroundColour(r);
      summaryHtml += `
        <div style="background-color: ${bgColour}; padding: 10px; margin: 10px 0;">
          <p><strong>Question ${r.questionNumber}:</strong> ${r.question}</p>
          <p><em>Displayed Choice:</em> ${r.choice}</p>
          <p><em>Displayed Explanation:</em> ${r.explanation}</p>
          <p><em>Correct Answer:</em> ${r.correctAnswer}. ${r.correctAnswerText}</p>
          <p><em>User Response:</em> ${getUserResponseLabel(r)}</p>
        </div>
        <hr/>
      `;
    });
  } else {
    summaryHtml += "<p>No harmful AI responses were displayed.</p>";
  }

  // Next section for helpful (normal) AI
  summaryHtml += `
    <h2>Results of the AI functioning normally (e.g., no adversarial prompt):</h2>
  `;

  if (helpfulResponses.length > 0) {
    helpfulResponses.forEach(r => {
      const bgColour = getBackgroundColour(r);
      summaryHtml += `
        <div style="background-color: ${bgColour}; padding: 10px; margin: 10px 0;">
          <p><strong>Question ${r.questionNumber}:</strong> ${r.question}</p>
          <p><em>Displayed Choice:</em> ${r.choice}</p>
          <p><em>Displayed Explanation:</em> ${r.explanation}</p>
          <p><em>Correct Answer:</em> ${r.correctAnswer}. ${r.correctAnswerText}</p>
          <p><em>User Response:</em> ${getUserResponseLabel(r)}</p>
        </div>
        <hr/>
      `;
    });
  } else {
    summaryHtml += "<p>No helpful AI responses were displayed.</p>";
  }

  // Place the final compiled HTML into the summary modal
  document.getElementById('summary-results').innerHTML = summaryHtml;

  const summaryModal = document.getElementById('summary-modal');
  summaryModal.style.display = 'block';

  document.getElementById('close-summary').onclick = function() {
    summaryModal.style.display = 'none';
  };
}
