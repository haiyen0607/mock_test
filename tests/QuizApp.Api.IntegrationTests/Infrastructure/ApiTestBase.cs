namespace QuizApp.Api.IntegrationTests.Infrastructure;

/// <summary>Lớp cơ sở: mọi class test dùng chung <see cref="QuizApiFactory"/> qua collection fixture.</summary>
[Collection(ApiCollection.Name)]
public abstract class ApiTestBase
{
    protected ApiTestBase(QuizApiFactory factory)
    {
        Factory = factory;
        Api = new ApiClient(factory);
    }

    protected QuizApiFactory Factory { get; }

    protected ApiClient Api { get; }
}
