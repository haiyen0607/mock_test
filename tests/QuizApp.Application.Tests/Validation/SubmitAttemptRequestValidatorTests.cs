using FluentValidation.TestHelper;
using QuizApp.Application.Dtos;
using QuizApp.Application.Validation;

namespace QuizApp.Application.Tests.Validation;

public class SubmitAttemptRequestValidatorTests
{
    private readonly SubmitAttemptRequestValidator _validator = new();

    [Fact]
    public void Validate_EmptySubmission_IsValid()
    {
        // Nộp bài trắng được phép (UC09 A1)
        _validator.TestValidate(new SubmitAttemptRequest()).ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void Validate_ValidAnswers_HasNoErrors()
    {
        var model = new SubmitAttemptRequest
        {
            Answers = { new() { QuestionId = 1, AnswerId = 2 }, new() { QuestionId = 3, ResponseText = "text" } }
        };

        _validator.TestValidate(model).ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void Validate_NullAnswers_ReportsRequired()
    {
        _validator.TestValidate(new SubmitAttemptRequest { Answers = null! })
            .ShouldHaveValidationErrorFor(x => x.Answers).WithErrorMessage("The Answers field is required.");
    }

    [Fact]
    public void Validate_MoreThan200Answers_ReportsTooMany()
    {
        var model = new SubmitAttemptRequest
        {
            Answers = Enumerable.Range(1, 201).Select(i => new AttemptAnswerRequest { QuestionId = i }).ToList()
        };

        _validator.TestValidate(model).ShouldHaveValidationErrorFor(x => x.Answers)
            .WithErrorMessage("Too many answers in one submission.");
    }

    [Theory]
    [InlineData(0)]
    [InlineData(-1)]
    public void Validate_MissingQuestionId_ReportsErrorWithIndexedKey(int questionId)
    {
        var model = new SubmitAttemptRequest
        {
            Answers = { new() { QuestionId = 1 }, new() { QuestionId = questionId } }
        };

        var result = _validator.TestValidate(model);

        result.ShouldHaveValidationErrorFor("Answers[1].QuestionId").WithErrorMessage("QuestionId is required.");
        result.ShouldNotHaveValidationErrorFor("Answers[0].QuestionId");
    }

    [Fact]
    public void Validate_ResponseTextTooLong_ReportsMaxLength()
    {
        var model = new SubmitAttemptRequest
        {
            Answers = { new() { QuestionId = 1, ResponseText = new string('r', 4001) } }
        };

        _validator.TestValidate(model).ShouldHaveValidationErrorFor("Answers[0].ResponseText")
            .WithErrorMessage("The field ResponseText must be a string with a maximum length of 4000.");
    }
}
