(function () {
    const margin = {
        top: 20,
        right: 10,
        bottom: 50,
        left: 50
    }
    const width = 960 - margin.left - margin.right
    const height = 700 - margin.top - margin.bottom

    function length(path) {
        return d3.create("svg:path").attr("d", path).node().getTotalLength();
    }
    x = d3.scaleLinear()
        .domain([-2.5, 2.5]).nice()
        .range([margin.left, width - margin.right])

    y = d3.scaleLinear()
        .domain([-4, 4]).nice()
        .range([height - margin.bottom, margin.top])

    line = d3.line()
        .defined(function (d) {
            return d.q !== null
        })
        .x(function (d) {
            return x(d.q)
        })
        .y(function (d) {
            return y(d.p)
        })

    xAxis = g => g
        .attr("transform", `translate(0,${height - margin.bottom})`)
        .call(d3.axisBottom(x).ticks(width / 80))
        .call(g => g.select(".domain").remove())
        .call(g => g.selectAll(".tick line").clone()
            .attr("y2", -height)
            .attr("stroke-opacity", 0.1))
        .call(g => g.append("text")
            .attr("x", width - 4)
            .attr("y", -4)
            .attr("font-weight", "bold")
            .attr("text-anchor", "end")
            .attr("fill", "black"))

    yAxis = g => g
        .attr("transform", `translate(${margin.left},0)`)
        .call(d3.axisLeft(y).ticks(height / 80))
        .call(g => g.select(".domain").remove())
        .call(g => g.selectAll(".tick line").clone()
            .attr("x2", width)
            .attr("stroke-opacity", 0.1))
        .call(g => g.select(".tick:last-of-type text").clone()
            .attr("x", 4)
            .attr("text-anchor", "start")
            .attr("font-weight", "bold")
            .attr("fill", "black"))


    function leapfrog(coords, dVdq, step_size) {
        start_grad = dVdq(coords.q)
        new_p = coords.p - 0.5 * step_size * dVdq(coords.q)
        new_q = coords.q + step_size * new_p
        new_p -= 0.5 * step_size * dVdq(new_q)
        return {
            q: new_q,
            p: new_p
        }
    }

    function inverse(cov) {
        det = cov[0][0] * cov[1][1] - cov[0][1] * cov[1][0]
        return [
            [cov[1][1] / det, -cov[1][0] / det],
            [-cov[0][1] / det, cov[0][0] / det]
        ]
    }

    function neg_log_normal(mu, sd) {
        return function (x) {
            return 0.5 * (Math.log(2 * Math.PI * sd * sd) + Math.pow((x - mu) / sd, 2))
        }
    }

    function d_neg_log_normal(mu, sd) {
        return x => (x - mu) / (sd * sd)
    }

    function mixture(dists, probs) {
        return function (x) {
            var logp = 0
            for (var i = 0; i < dists.length; i++) {
                logp += probs[i] * Math.exp(-dists[i](x))
            }
            return -Math.log(logp)
        }
    }

    function d_mixture(dists, grad_dists, probs, mixture_p) {
        return function (x) {
            denom = Math.exp(-mixture_p(x))
            var logp = 0
            for (var i = 0; i < dists.length; i++) {
                logp += probs[i] * -grad_dists[i](x) * Math.exp(-dists[i](x))
            }
            return -logp / denom
        }
    }

    function update(data, svg) {

        // JOIN new data with old elements.
        var trajectory = svg.selectAll("path")
            .data([data])

        // ENTER new elements present in new data.
        trajectory.enter().append("path")
            .merge(trajectory)
            .attr("class", "line")
            .attr("d", line)

        last_point = data[data.length - 1]
        comet.attr("transform", "translate(" + [x(last_point.q), y(last_point.p)] + ")")
    }


    const svg = d3.select('#drawing');

    svg.append("g")
        .call(xAxis);

    svg.append("g")
        .call(yAxis);

    var comet = svg.append("circle")
        .attr("r", 5)
        .attr("fill", "none")
        .attr("stroke", "black")
        .attr("stroke-width", "2px")
        .attr("transform", "translate(" + [x(0), y(0)] + ")")

    function energy(coords, neg_log_dist) {
        momentum = neg_log_normal(0, 1)
        return momentum(coords.p) + neg_log_dist(coords.q)
    }

    var data = [];

    function chart() {

        const momentum = d3.randomNormal()
        const dists = [
            neg_log_normal(1, 0.3),
            neg_log_normal(0, 0.2),
            neg_log_normal(-1, 0.5)
        ]
        const grad_dists = [
            d_neg_log_normal(1, 0.3),
            d_neg_log_normal(0, 0.2),
            d_neg_log_normal(-1, 0.5)
        ]
        const probs = [0.4, 0.3, 0.3]
        const neg_log_p = mixture(dists, probs)


        data.push({
            q: null,
            p: null
        })
        if (data.length > 2) {
            data.push({
                q: data[data.length - 2].q,
                p: momentum()
            })
        } else {
            data.push({
                q: momentum(),
                p: momentum()
            })

        }

        dVdq = d_mixture(dists, grad_dists, probs, neg_log_p)
        update(data, svg)

        interval = d3.interval(function (elapsed) {
            if (elapsed > 1000) {
                interval.stop()
                setTimeout(chart, 500)
            }
            for (var i = 0; i < 10; i++) {
                new_coords = leapfrog(data[data.length - 1], dVdq, 0.01)
                data.push(new_coords)
            }
            update(data, svg);
        }, 30);

    }
    chart()

}).call(this);
