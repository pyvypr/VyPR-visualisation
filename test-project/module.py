import time

def calculate_something(a, b):
  result = a + b
  time.sleep(0.1)
  return result

def function1():
  a = 10
  b = 10
  result1 = calculate_something(a, b)
  for i in range(10):
    calculate_something(i, i+1)
  result2 = calculate_something(result1, b)
  a = 30
  result3 = calculate_something(a, b)
  print(result1, result2, result3)
