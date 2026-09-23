// Cầu nối giữa Entity (dùng để làm việc với DB) và DTO (dùng để giao tiếp API <-> Client).
using QuizApp.Api.Entities;
using QuizApp.Api.Enums;

namespace QuizApp.Api.Dtos;

public static class Mapper
{
    public static UserDto ToUser(User user) =>
        new(user.UserId, user.Username, user.Email, user.Role.ToString(), user.Status.ToString(), user.CreatedAt);

    public static QuestionBankDto ToQuestionBank(QuestionBank bank) =>
        new(bank.QuestionBankId, bank.Name, bank.Description, bank.IsPublic, bank.Questions.Count, bank.CreatedAt);

    public static AnswerDto ToAnswer(Answer answer) =>
        new(answer.AnswerId, answer.QuestionId, answer.Content, answer.IsCorrect);

    public static QuestionDto ToQuestion(Question question) =>
        new(question.QuestionId, question.QuestionBankId, question.Content, question.QuestionType.ToString(),
            question.Status.ToString(), question.Answers.OrderBy(a => a.AnswerId).Select(ToAnswer).ToList());

    public static PublicQuestionDto ToPublicQuestion(Question question) =>
        new(question.QuestionId, question.QuestionBankId, question.QuestionBank?.Name ?? string.Empty,
            question.Content, question.QuestionType.ToString());

    public static QuizListItemDto ToListItem(Quiz quiz) =>
        new(quiz.QuizId, quiz.Title, quiz.Description, quiz.Duration, quiz.IsPublished, quiz.Status.ToString(),
            quiz.QuizQuestions.Count, quiz.Owner?.Username ?? string.Empty, quiz.CreatedAt);

    public static QuestionSummaryDto ToQuestionSummary(QuizQuestion qq) =>
        new(qq.Question!.QuestionId, qq.OrderIndex, qq.Question.Content, qq.Question.QuestionType.ToString(), qq.Question.Answers.Count);

    public static QuizDetailDto ToDetail(Quiz quiz) =>
        new(quiz.QuizId, quiz.Title, quiz.Description, quiz.Duration, quiz.IsPublished, quiz.Status.ToString(),
            quiz.Owner?.Username ?? string.Empty,
            quiz.QuizQuestions.OrderBy(qq => qq.OrderIndex).Select(ToQuestionSummary).ToList());

    /// <summary>UC07/UC08 – nội dung Quiz khi làm bài, KHÔNG lộ IsCorrect.</summary>
    public static AttemptQuestionDto ToAttemptQuestion(Question question) =>
        new(question.QuestionId, question.Content, question.QuestionType.ToString(),
            QuestionTypeRules.UsesPredefinedAnswers(question.QuestionType)
                ? question.Answers.OrderBy(a => a.AnswerId).Select(a => new AnswerOptionDto(a.AnswerId, a.Content)).ToList()
                : new List<AnswerOptionDto>());

    public static AttemptContentDto ToAttemptContent(QuizAttempt attempt, Quiz quiz) =>
        new(attempt.AttemptId, quiz.QuizId, quiz.Title, quiz.Duration,
            quiz.QuizQuestions.OrderBy(qq => qq.OrderIndex).Select(qq => ToAttemptQuestion(qq.Question!)).ToList());
}
