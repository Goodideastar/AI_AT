from dotenv import load_dotenv
load_dotenv()

import logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

from fastapi import FastAPI
# from langchain.agents import create_agent
# from langgraph.graph import StateGraph, MessagesState, START, END
# from langchain_openai import ChatOpenAI
from config.redis import redis_client
from api.register import router as register_route
from api.captcha import router as captcha_route
from api.login import router as login_route
from api.logout import router as logout_route
from api.destroy import router as destroy_route
from api.market import router as market_route
from api.strategy import router as strategy_route
from api.backtest import router as backtest_route
from security.jwt import JWTBearer

import os

app=FastAPI(authentication_scheme=JWTBearer())

app.include_router(logout_route,prefix="/api")
app.include_router(login_route,prefix="/api")
app.include_router(register_route,prefix="/api")
app.include_router(destroy_route,prefix="/api")
app.include_router(captcha_route,prefix="/api")
app.include_router(market_route,prefix="/api")
app.include_router(strategy_route,prefix="/api")
# deepseek=ChatOpenAI(
#     model=os.getenv("MODEL_NAME"),
#     api_key=os.getenv("API_KEY"),
#     base_url=os.getenv("BASE_URL"),
#     max_completion_tokens=1000,
#     temperature=0.2
    
# )

# agent = create_agent(
#     model=deepseek,
#     tools=[],
#     system_prompt="你是一个有帮助的研究助理。"
# )

# def mock_llm(state: MessagesState):
#     return {"messages": [{"role": "ai", "content": "hello world"}]}

# workflow = StateGraph(MessagesState)
# workflow.add_node(mock_llm)
# workflow.add_edge(START, "mock_llm")
# workflow.add_edge("mock_llm", END)
# workflow = workflow.compile()

# workflow.invoke({"messages": [{"role": "user", "content": "hi!"}]})

if __name__== "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
   