using System.Net;
using System.Text.Json;
using QuizApp.Api.IntegrationTests.Infrastructure;

namespace QuizApp.Api.IntegrationTests;

/// <summary>
/// Validation request (FluentValidation + lỗi đọc JSON): với mỗi payload không hợp lệ, kiểm tra status, code,
/// tên field lỗi VÀ nội dung thông báo — giữ nguyên hợp đồng lỗi mà frontend đang hiển thị.
/// Định dạng errors: "Field: msg1 | msg2 || Field2: msg" (field và message sắp xếp theo thứ tự ordinal).
/// </summary>
public sealed class ValidationTests : ApiTestBase
{
    public ValidationTests(QuizApiFactory factory) : base(factory) { }

    private static string Long(int n) => new('x', n);

    private static string J(object body) => JsonSerializer.Serialize(body);

    private const string RegisterEmptyErrors =
        "Email: Email is required. | The Email field is not a valid e-mail address. || " +
        "Password: Password is required. | Password must be at least 6 characters. || " +
        "Username: The field Username must be a string with a minimum length of 3 and a maximum length of 100. | Username is required.";

    /// <summary>label, method, path, JSON body, dùng token admin?, status mong đợi, code mong đợi, errors mong đợi.</summary>
    public static TheoryData<string, string, string, string, bool, int, string, string> Cases => new()
    {
        // ---------- Auth ----------
        { "register empty object", "POST", "/api/auth/register", "{}", false, 400, "VALIDATION_FAILED", RegisterEmptyErrors },
        { "register blanks", "POST", "/api/auth/register", J(new { username = "", email = "", password = "" }), false, 400, "VALIDATION_FAILED", RegisterEmptyErrors },
        { "register whitespace", "POST", "/api/auth/register", J(new { username = "   ", email = "  ", password = "      " }), false, 400, "VALIDATION_FAILED",
            "Email: Email is required. | The Email field is not a valid e-mail address. || Password: Password is required. || Username: Username is required." },
        { "register short", "POST", "/api/auth/register", J(new { username = "ab", email = "bad-email", password = "123" }), false, 400, "VALIDATION_FAILED",
            "Email: The Email field is not a valid e-mail address. || Password: Password must be at least 6 characters. || " +
            "Username: The field Username must be a string with a minimum length of 3 and a maximum length of 100." },
        { "register too long", "POST", "/api/auth/register", J(new { username = Long(101), email = Long(250) + "@x.com", password = Long(101) }), false, 400, "VALIDATION_FAILED",
            "Email: The field Email must be a string with a maximum length of 255. || Password: Password must be at least 6 characters. || " +
            "Username: The field Username must be a string with a minimum length of 3 and a maximum length of 100." },
        { "register nulls", "POST", "/api/auth/register", J(new { username = (string?)null, email = (string?)null, password = (string?)null }), false, 400, "VALIDATION_FAILED",
            "Email: Email is required. || Password: Password is required. || Username: Username is required." },
        { "login empty", "POST", "/api/auth/login", "{}", false, 400, "VALIDATION_FAILED",
            "Password: Password is required. || UsernameOrEmail: Username or email is required." },
        { "login too long", "POST", "/api/auth/login", J(new { usernameOrEmail = Long(256), password = Long(101) }), false, 400, "VALIDATION_FAILED",
            "Password: The field Password must be a string with a maximum length of 100. || UsernameOrEmail: The field UsernameOrEmail must be a string with a maximum length of 255." },
        { "malformed json", "POST", "/api/auth/login", "{\"usernameOrEmail\": ", false, 400, "VALIDATION_FAILED",
            "$.usernameOrEmail: Expected depth to be zero at the end of the JSON payload. There is an open JSON object or array that should be closed. Path: $.usernameOrEmail | LineNumber: 0 | BytePositionInLine: 20." },

        // ---------- Quiz ----------
        { "quiz empty", "POST", "/api/quizzes", "{}", false, 400, "VALIDATION_FAILED",
            "Duration: Duration must be between 1 and 600 minutes. || Title: Title is required." },
        { "quiz bad values", "POST", "/api/quizzes", J(new { title = Long(256), description = Long(2001), duration = 601 }), false, 400, "VALIDATION_FAILED",
            "Description: The field Description must be a string with a maximum length of 2000. || Duration: Duration must be between 1 and 600 minutes. || Title: Title must not exceed 255 characters." },
        { "quiz duration 0", "POST", "/api/quizzes", J(new { title = "ok", duration = 0 }), false, 400, "VALIDATION_FAILED",
            "Duration: Duration must be between 1 and 600 minutes." },
        { "quiz whitespace title", "POST", "/api/quizzes", J(new { title = "   ", duration = 5 }), false, 400, "VALIDATION_FAILED",
            "Title: Title is required." },
        { "quiz duration as string", "POST", "/api/quizzes", J(new { title = "ok", duration = "abc" }), false, 400, "VALIDATION_FAILED",
            "$.duration: The JSON value could not be converted to System.Int32. Path: $.duration | LineNumber: 0 | BytePositionInLine: 30." },

        // ---------- Banks / questions / answers ----------
        { "bank empty", "POST", "/api/question-banks", "{}", false, 400, "VALIDATION_FAILED", "Name: Name is required." },
        { "bank too long", "POST", "/api/question-banks", J(new { name = Long(256), description = Long(2001) }), false, 400, "VALIDATION_FAILED",
            "Description: The field Description must be a string with a maximum length of 2000. || Name: The field Name must be a string with a maximum length of 255." },
        { "bank question empty", "POST", "/api/question-banks/1/questions", "{}", false, 400, "VALIDATION_FAILED",
            "Content: Content is required. || QuestionType: QuestionType is required." },
        { "bank question bad type", "POST", "/api/question-banks/1/questions", J(new { content = "q", questionType = "Essay" }), false, 400, "VALIDATION_FAILED",
            "$.questionType: The JSON value could not be converted to System.Nullable`1[QuizApp.Domain.Enums.QuestionType]. Path: $.questionType | LineNumber: 0 | BytePositionInLine: 37." },
        { "bank question type number 99", "POST", "/api/question-banks/1/questions", J(new { content = "q", questionType = 99 }), false, 400, "VALIDATION_FAILED",
            "QuestionType: QuestionType is not supported." },
        { "bank question long + bad answers", "POST", "/api/question-banks/1/questions",
            J(new { content = Long(4001), questionType = "SingleChoice", answers = new object[] { new { content = "", isCorrect = true }, new { content = Long(2001) } } }),
            false, 400, "VALIDATION_FAILED",
            "Answers[0].Content: Content is required. || Answers[1].Content: The field Content must be a string with a maximum length of 2000. || " +
            "Content: The field Content must be a string with a maximum length of 4000." },
        { "update question empty", "PUT", "/api/question-banks/questions/1", "{}", false, 400, "VALIDATION_FAILED",
            "Content: Content is required. || QuestionType: QuestionType is required." },
        { "replace question too many", "PUT", "/api/question-banks/questions/1/full",
            J(new { content = "q", questionType = "MultipleChoice", answers = Enumerable.Range(0, 51).Select(i => new { content = $"a{i}", isCorrect = i == 0 }) }),
            false, 400, "VALIDATION_FAILED", "Answers: A question can have at most 50 answers." },
        { "answer empty", "POST", "/api/question-banks/questions/1/answers", "{}", false, 400, "VALIDATION_FAILED", "Content: Content is required." },
        { "answer too long", "PUT", "/api/question-banks/answers/1", J(new { content = Long(2001), isCorrect = false }), false, 400, "VALIDATION_FAILED",
            "Content: The field Content must be a string with a maximum length of 2000." },

        // ---------- Quiz questions ----------
        { "quiz add question payload empty", "POST", "/api/quizzes/1/questions", J(new { newQuestion = new { } }), false, 400, "VALIDATION_FAILED",
            "NewQuestion.Content: Content is required. || NewQuestion.QuestionType: QuestionType is required." },
        { "quiz add question payload long", "POST", "/api/quizzes/1/questions",
            J(new { newQuestion = new { content = Long(4001), questionType = "Nope", answers = new[] { new { content = "" } } } }), false, 400, "VALIDATION_FAILED",
            "$.newQuestion.questionType: The JSON value could not be converted to System.Nullable`1[QuizApp.Domain.Enums.QuestionType]. Path: $.newQuestion.questionType | LineNumber: 0 | BytePositionInLine: 4051." },
        { "reorder empty list", "PUT", "/api/quizzes/1/questions/order", J(new { questionIds = Array.Empty<int>() }), false, 400, "VALIDATION_FAILED",
            "QuestionIds: The field QuestionIds must be a string or array type with a minimum length of '1'." },
        { "reorder missing", "PUT", "/api/quizzes/1/questions/order", "{}", false, 400, "VALIDATION_FAILED",
            "QuestionIds: The field QuestionIds must be a string or array type with a minimum length of '1'." },
        { "reorder too many", "PUT", "/api/quizzes/1/questions/order", J(new { questionIds = Enumerable.Range(1, 501) }), false, 400, "VALIDATION_FAILED",
            "QuestionIds: The field QuestionIds must be a string or array type with a maximum length of '500'." },

        // ---------- Attempts / grading ----------
        // Thiếu "answers" hợp lệ (mặc định danh sách rỗng) -> đi tiếp tới service: attempt không thuộc user -> 404
        { "submit missing answers", "POST", "/api/attempts/2147483647/submit", "{}", false, 404, "ATTEMPT_NOT_FOUND", "" },
        { "submit bad items", "POST", "/api/attempts/1/submit", J(new { answers = new[] { new { questionId = 0, responseText = Long(4001) } } }), false, 400, "VALIDATION_FAILED",
            "Answers[0].QuestionId: QuestionId is required. || Answers[0].ResponseText: The field ResponseText must be a string with a maximum length of 4000." },
        { "submit too many", "POST", "/api/attempts/1/submit", J(new { answers = Enumerable.Range(0, 201).Select(_ => new { questionId = 1 }) }), false, 400, "VALIDATION_FAILED",
            "Answers: Too many answers in one submission." },
        { "grade missing", "PUT", "/api/attempt-answers/1/grade", "{}", false, 400, "VALIDATION_FAILED", "IsCorrect: IsCorrect is required." },

        // ---------- Admin ----------
        { "admin user status empty", "PUT", "/api/admin/users/2/status", "{}", true, 400, "VALIDATION_FAILED", "Status: Status is required." },
        { "admin quiz status empty", "PUT", "/api/admin/quizzes/1/status", "{}", true, 400, "VALIDATION_FAILED", "Status: Status is required." },
        { "admin question status empty", "PUT", "/api/admin/questions/1/status", "{}", true, 400, "VALIDATION_FAILED", "Status: Status is required." },
    };

    [Theory]
    [MemberData(nameof(Cases))]
    public async Task Invalid_payload_returns_expected_errors(string label, string method, string path, string body, bool asAdmin,
        int expectedStatus, string expectedCode, string expectedErrors)
    {
        _ = label; // chỉ để hiển thị tên case trong test explorer
        var token = asAdmin
            ? await Api.LoginAsync(ApiClient.SeedAdmin, ApiClient.SeedAdminPassword)
            : await Api.LoginAsync(ApiClient.SeedUser, ApiClient.SeedUserPassword);

        var response = await Api.AuthorizedClient(token).SendJsonAsync(new HttpMethod(method), path, body);

        var problem = await response.ShouldBeProblemAsync((HttpStatusCode)expectedStatus, expectedCode);
        Format(problem.Errors).Should().Be(expectedErrors);
    }

    /// <summary>Cùng định dạng với script validation-probe: field sắp xếp, message sắp xếp (ordinal).</summary>
    private static string Format(IReadOnlyDictionary<string, string[]> errors) =>
        string.Join(" || ", errors.Keys.OrderBy(k => k, StringComparer.Ordinal)
            .Select(k => $"{k}: {string.Join(" | ", errors[k].OrderBy(m => m, StringComparer.Ordinal))}"));
}
