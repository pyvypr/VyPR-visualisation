verification_conf = {
    "module" : {
        "function1" : [
            Forall(s = changes('a')).\
            Forall(c = calls('calculate_something', after='s')).\
            Check(lambda s, c : c.duration()._in([0, 2]) )
        ]
    }    
}
