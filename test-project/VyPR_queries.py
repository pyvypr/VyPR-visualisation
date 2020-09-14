verification_conf = {
    "module" : {
        "function1" : [
            Forall(s = changes('a')).\
            Check(lambda s : timeBetween(s, s.next_call("calculate_something").result())._in([0, 0.5]) )
        ]
    }
}
