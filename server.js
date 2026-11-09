require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const path = require("path");
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const questionSchema = new mongoose.Schema({
  questionText: { type: String, required: true, trim: true },
  options: [{ type: String, trim: true }]
}, { timestamps: true });
const responseSchema = new mongoose.Schema({
  respondentName: { type: String, required: true, trim: true },
  answers: [{
    questionId: { type: mongoose.Schema.Types.ObjectId, ref: "Question" },
    questionText: String,
    answer: { type: String, required: true }
  }],
  submittedAt: { type: Date, default: Date.now }
});
const Question = mongoose.model("Question", questionSchema);
const SurveyResponse = mongoose.model("SurveyResponse", responseSchema);

// Add one question to the question bank.
app.post("/api/questions", async (req, res) => {
  try {
    const { questionText, options = [] } = req.body;
    if (!questionText || options.filter(Boolean).length < 2)
      return res.status(400).json({ message: "Enter a question and at least two options." });
    const question = await Question.create({ questionText, options });
    res.status(201).json({ message: "Question added.", question });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

// Select five different questions randomly from MongoDB.
app.get("/api/survey/questions", async (req, res) => {
  try {
    const questions = await Question.aggregate([{ $sample: { size: 5 } }]);
    if (questions.length < 5)
      return res.status(400).json({ message: `Only ${questions.length} questions available. Add at least five.` });
    res.json(questions);
  } catch (e) { res.status(500).json({ message: e.message }); }
});

// Validate and save exactly five answers for one respondent.
app.post("/api/survey/submit", async (req, res) => {
  try {
    const { respondentName, answers } = req.body;
    if (!respondentName?.trim()) return res.status(400).json({ message: "Enter your name." });
    if (!Array.isArray(answers) || answers.length !== 5 || answers.some(a => !a.answer?.trim()))
      return res.status(400).json({ message: "Please answer all five questions." });
    if (new Set(answers.map(a => String(a.questionId))).size !== 5)
      return res.status(400).json({ message: "Five different questions are required." });
    const questions = await Question.find({ _id: { $in: answers.map(a => a.questionId) } });
    if (questions.length !== 5) return res.status(400).json({ message: "Invalid questions. Refresh and try again." });
    const map = new Map(questions.map(q => [String(q._id), q]));
    const saved = await SurveyResponse.create({
      respondentName: respondentName.trim(),
      answers: answers.map(a => ({
        questionId: map.get(String(a.questionId))._id,
        questionText: map.get(String(a.questionId)).questionText,
        answer: a.answer.trim()
      }))
    });
    res.status(201).json({ message: "Survey submitted successfully!", responseId: saved._id });
  } catch (e) { res.status(500).json({ message: e.message }); }
});

// Admin/demo endpoints to inspect stored questions and submitted responses.
app.get("/api/questions", async (req, res) => res.json(await Question.find().sort({ createdAt: -1 })));
app.get("/api/responses", async (req, res) => res.json(await SurveyResponse.find().sort({ submittedAt: -1 })));

async function seedQuestions() {
  if (await Question.countDocuments()) return;
  const questions = [
    ["How satisfied are you with our service?", ["Very satisfied", "Satisfied", "Neutral", "Dissatisfied"]],
    ["How often do you use our application?", ["Daily", "Weekly", "Monthly", "Rarely"]],
    ["Which feature do you use the most?", ["Dashboard", "Reports", "Notifications", "Profile"]],
    ["Was the application easy to use?", ["Very easy", "Easy", "Average", "Difficult"]],
    ["How did you hear about us?", ["Friends", "Social media", "Website", "Other"]],
    ["Would you recommend this application?", ["Definitely", "Maybe", "Not sure", "No"]],
    ["How would you rate the design?", ["Excellent", "Good", "Average", "Needs improvement"]],
    ["What is your main purpose for using it?", ["Learning", "Work", "Entertainment", "Other"]],
    ["How frequently should new features be added?", ["Weekly", "Monthly", "Every few months", "When needed"]],
    ["Are you satisfied with the overall experience?", ["Yes", "Mostly", "Not sure", "No"]]
  ].map(([questionText, options]) => ({ questionText, options }));
  await Question.insertMany(questions);
  console.log("10 sample questions inserted.");
}
const PORT = process.env.PORT || 3002;
mongoose.connect(process.env.MONGODB_URI)
  .then(async () => {
    console.log("Connected to MongoDB");
    await seedQuestions();
    app.listen(PORT, () => console.log(`Survey app running at http://localhost:${PORT}`));
  })
  .catch(err => { console.error("MongoDB connection failed:", err.message); process.exit(1); });
