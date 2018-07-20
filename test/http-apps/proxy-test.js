
var Q = require("q");
var Http = require("../../http");
var Apps = require("../../http-apps");
var FS = require("../../fs");

describe("http proxy", function () {

    it("should work", function () {

        var requestProxy;
        var responseProxy;
        var requestActual;
        var responseActual;

        var app = Apps.Chain()
        .use(Apps.Trap, function (response) {
            responseActual = response;
            return response;
        })
        .use(Apps.Tap, function (request) {
            requestActual = request;
        })
        .use(function (next) {
            return Apps.Branch({
                "foo": Apps.Branch({
                    "bar": (
                        new Apps.Chain()
                        .use(Apps.Cap)
                        .use(function () {
                            return Apps.Content(["Hello, World!"]);
                        })
                        .end()
                    )
                })
            });
        })
        .end();

        var server1 = Http.Server(app);

        return server1.listen(0)
        .then(function (server1) {
            var port = server1.node.address().port;

            var server2 = Http.Server(
                Apps.Trap(
                    Apps.Tap(
                        Apps.ProxyTree("http://127.0.0.1:" + port + "/foo/"),
                        function (request) {
                            requestProxy = request;
                        }
                    ),
                    function (response) {
                        responseProxy = response;
                        return response;
                    }
                )
            );

            return [server1, server2.listen(0)];
        })
        .spread(function (server1, server2) {
            var port = server2.node.address().port;
            return Http.read({
                port: port,
                path: "/bar",
                charset: "utf-8"
            })
            .then(function (content) {
                expect(content).toBe("Hello, World!");
                expect(requestActual).toBeTruthy();
                expect(responseActual).toBeTruthy();
                expect(requestProxy).toBeTruthy();
                expect(responseProxy).toBeTruthy();
            }, function (error) {
                if (!error.response) {
                    throw error;
                }
                return error.response.body.read()
                .then(function (body) {
                    console.error(body);
                    throw error;
                });
            })
            .finally(server1.stop)
            .finally(server2.stop)
        })

    });

});
