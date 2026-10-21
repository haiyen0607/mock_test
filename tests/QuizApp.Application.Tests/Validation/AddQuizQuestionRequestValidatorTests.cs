using FluentValidation.TestHelper;
using QuizApp.Application.Dtos;
using QuizApp.Application.Validation;
using QuizApp.Domain.Enums;

namespace QuizApp.Application.Tests.Validation;

/// <summary>Lỗi của câu hỏi mới có key dạng "NewQuestion.Content" (NewQuestionPayloadValidator lồng bên trong).</summary>
public class AddQuizQuestionRequestValidatorTests
{
    private readonly AddQuizQuestionRequestValidator _validator = new();

    [Fact]
    public void Validate_ReuseExistingQuestion_HasNoErrors()
    {
        _validator.TestValidate(new AddQuizQuestionRequest { QuestionId = 5 }).ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void Validate_ValidNewQuestion_HasNoErrors()
    {
        var model = new AddQuizQuestionRequest
        {
            NewQuestion = new NewQuestionPayload
            {
                Content = "Thủ đô của Việt Nam?",
                QuestionType = QuestionType.ShortAnswer,
                Answers = new List<AnswerRequest>()
            }
        };

        _validator.TestValidate(model).ShouldNotHaveAnyValidationErrors();
    }

    [Fact]
    public void Validate_InvalidNewQuestion_ReportsNestedKeys()
    {
        var model = new AddQuizQuestionRequest
        {
            NewQuestion = new NewQuestionPayload
            {
                Content = "",
                QuestionType = null,
                Answers = new List<AnswerRequest> { new() { Content = "ok" }, new() { Content = " " } }
            }
        };

        var result = _validator.TestValidate(model);

        result.ShouldHaveValidationErrorFor("NewQuestion.Content").WithErrorMessage("Content is required.");
        result.ShouldHaveValidationErrorFor("NewQuestion.QuestionType").WithErrorMessage("QuestionType is required.");
        result.ShouldHaveValidationErrorFor("NewQuestion.Answers[1].Content").WithErrorMessage("Content is required.");
        result.ShouldNotHaveValidationErrorFor("NewQuestion.Answers[0].Content");
    }

    [Fact]
    public void Validate_NewQuestionWithUndefinedType_ReportsNotSupported()
    {
        var model = new AddQuizQuestionRequest
        {
            NewQuestion = new NewQuestionPayload { Content = "Q", QuestionType = (QuestionType)42 }
        };

        _validator.TestValidate(model).ShouldHaveValidationErrorFor("NewQuestion.QuestionType")
            .WithErrorMessage("QuestionType is not supported.");
    }

    [Fact]
    public void Validate_NewQuestionWithNullAnswers_ReportsRequired()
    {
        var model = new AddQuizQuestionRequest
        {
            NewQuestion = new NewQuestionPayload { Content = "Q", QuestionType = QuestionType.SingleChoice, Answers = null! }
        };

        _validator.TestValidate(model).ShouldHaveValidationErrorFor("NewQuestion.Answers")
            .WithErrorMessage("The Answers field is required.");
    }
}
