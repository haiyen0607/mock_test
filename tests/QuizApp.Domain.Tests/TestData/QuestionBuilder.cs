using QuizApp.Domain.Entities;
using QuizApp.Domain.Enums;
using QuizApp.Domain.Scoring;

namespace QuizApp.Domain.Tests.TestData;

/// <summary>Builder dựng nhanh Question (kèm Answer) cho test chấm điểm.</summary>
public sealed class QuestionBuilder
{
    private int _questionId = 1;
    private QuestionType _type = QuestionType.SingleChoice;
    private ContentStatus _status = ContentStatus.Active;
    private readonly List<Answer> _answers = new();

    public static QuestionBuilder SingleChoice(int questionId = 1) => new QuestionBuilder().WithId(questionId).OfType(QuestionType.SingleChoice);
    public static QuestionBuilder MultipleChoice(int questionId = 1) => new QuestionBuilder().WithId(questionId).OfType(QuestionType.MultipleChoice);
    public static QuestionBuilder TrueFalse(int questionId = 1) => new QuestionBuilder().WithId(questionId).OfType(QuestionType.TrueFalse);
    public static QuestionBuilder ShortAnswer(int questionId = 1) => new QuestionBuilder().WithId(questionId).OfType(QuestionType.ShortAnswer);

    public QuestionBuilder WithId(int questionId)
    {
        _questionId = questionId;
        return this;
    }

    public QuestionBuilder OfType(QuestionType type)
    {
        _type = type;
        return this;
    }

    public QuestionBuilder WithStatus(ContentStatus status)
    {
        _status = status;
        return this;
    }

    public QuestionBuilder WithAnswer(int answerId, bool isCorrect = false)
    {
        _answers.Add(new Answer { AnswerId = answerId, Content = $"Answer {answerId}", IsCorrect = isCorrect });
        return this;
    }

    public QuestionBuilder WithCorrectAnswer(int answerId) => WithAnswer(answerId, isCorrect: true);

    public Question Build()
    {
        var question = new Question
        {
            QuestionId = _questionId,
            Content = $"Question {_questionId}",
            QuestionType = _type,
            Status = _status
        };

        foreach (var answer in _answers)
        {
            answer.QuestionId = _questionId;
            question.Answers.Add(answer);
        }

        return question;
    }
}

/// <summary>Tạo nhanh dòng trả lời gửi lên (<see cref="SubmittedAnswer"/>).</summary>
public static class Submitted
{
    public static SubmittedAnswer Choice(int questionId, int? answerId, int index = 0) =>
        new(index, questionId, answerId, null);

    public static SubmittedAnswer Text(int questionId, string? text, int index = 0) =>
        new(index, questionId, null, text);
}
