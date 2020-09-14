from init_vypr import vypr
from module import function1, f

if __name__ == "__main__":
  print("Running program with VyPR")
  vypr.initialise()
  function1()
  #f(11)
  vypr.end_monitoring()
  print("Program and VyPR monitoring thread ended.")
